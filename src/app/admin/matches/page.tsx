import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getSeatAvailabilityForMatches, type ZoneAvailability } from "@/lib/seat-availability";
import { STADIUM_ZONE_CODES, type StadiumZoneCode } from "@/lib/stadium-zones";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import { SEASON_LABEL, SEASON_TIERS, getSeasonPublicSaleLimit } from "@/lib/season-pass-tiers";
import DeleteMatchButton from "./DeleteMatchButton";
import BookingSaleToggle from "./BookingSaleToggle";
import SeasonPassSalePhaseControl from "./SeasonPassSalePhaseControl";
import { activeSeasonPassOrderWhere, expirePendingSeasonPassPurchases } from "@/lib/season-pass-expiry";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  SCHEDULED: "ยังไม่เปิด",
  ON_SALE: "เปิดจอง",
  SOLD_OUT: "เต็ม",
  CANCELLED: "ยกเลิก",
  FINISHED: "จบแล้ว",
};
const competitionLabel: Record<string, string> = {
  LEAGUE: "บอลลีก",
  CUP: "บอลถ้วย",
};
const statusClassName: Record<string, string> = {
  SCHEDULED: "border-slate-200 bg-slate-100 text-slate-700",
  ON_SALE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SOLD_OUT: "border-amber-200 bg-amber-50 text-amber-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  FINISHED: "border-blue-200 bg-blue-50 text-blue-700",
};

export default async function AdminMatchesPage(props: {
  searchParams: Promise<{ competition?: string }>;
}) {
  await verifyPermission("MATCHES");
  const { competition: rawCompetition } = await props.searchParams;
  const competition = rawCompetition === "CUP" || rawCompetition === "LEAGUE"
    ? rawCompetition
    : undefined;

  if (!competition) {
    await expirePendingSeasonPassPurchases();
    const [purchaseSettings, seasonOrderGroups, seasonQuotas, availableVvipBarcodes] = await Promise.all([
      getTicketPurchaseSettings(),
      prisma.seasonPassOrder.groupBy({
        by: ["tierId", "salesChannel"],
        where: { seasonLabel: SEASON_LABEL, ...activeSeasonPassOrderWhere() },
        _count: { _all: true },
      }),
      prisma.seasonPassZoneQuota.findMany({ where: { seasonLabel: SEASON_LABEL } }),
      prisma.seasonPassBarcode.count({
        where: { tierId: "vvip-elite", seasonLabel: SEASON_LABEL, isGenerated: true, orderId: null },
      }),
    ]);
    const countOrders = (channels?: readonly string[]) => seasonOrderGroups
      .filter((group) => !channels || channels.includes(group.salesChannel))
      .reduce((sum, group) => sum + group._count._all, 0);
    const activeVvip = seasonOrderGroups
      .filter((group) => group.tierId === "vvip-elite")
      .reduce((sum, group) => sum + group._count._all, 0);
    const configuredPublicCapacity = SEASON_TIERS
      .filter((tier) => tier.id !== "vvip-elite")
      .reduce((sum, tier) => {
        const tierQuotas = seasonQuotas.filter((quota) => quota.tierId === tier.id);
        if (tierQuotas.length === tier.allowedSeatZones.length) {
          return sum + tierQuotas.reduce(
            (tierSum, quota) => tierSum + Math.max(0, quota.totalSeats - quota.sponsorReserved),
            0,
          );
        }
        return sum + (getSeasonPublicSaleLimit(tier) ?? 0);
      }, 0);
    const seasonPassStats = {
      total: configuredPublicCapacity + activeVvip + availableVvipBarcodes,
      staffBooked: countOrders(["OFFLINE", "INTERNAL"]),
      onlineBooked: countOrders(["ONLINE"]),
      remaining: 0,
    };
    seasonPassStats.remaining = Math.max(
      0,
      seasonPassStats.total - seasonPassStats.staffBooked - seasonPassStats.onlineBooked,
    );
    return (
      <div>
        <h1 className="text-xl font-bold">จัดการแมตช์</h1>
        <p className="mt-1 text-sm text-slate-600">เลือกประเภทการแข่งขันที่ต้องการจัดการ</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MatchManagementCard
            href="/admin/matches?competition=LEAGUE"
            title="จัดการแมตช์บอลลีก"
            description="เพิ่ม แก้ไข และดูรายการแมตช์ฟุตบอลลีก"
            className="border-emerald-200 bg-emerald-50 hover:border-emerald-400"
            saleControl={{ type: "LEAGUE", isOpen: purchaseSettings.leagueBookingOpen }}
          />
          <MatchManagementCard
            href="/admin/matches?competition=CUP"
            title="จัดการแมตช์บอลถ้วย"
            description="เพิ่ม แก้ไข และดูรายการแมตช์ฟุตบอลถ้วย"
            className="border-amber-200 bg-amber-50 hover:border-amber-400"
          />
          <MatchManagementCard
            href="/admin/matches/season-seats"
            title="จัดสรรที่นั่งบัตรรายปี"
            description="กำหนดโควตารวม ที่นั่งสปอนเซอร์ และจำนวนเปิดขายแยกตามแพ็กเกจและโซน"
            className="border-blue-200 bg-blue-50 hover:border-blue-400"
            seasonPassControl={{
              phase: purchaseSettings.seasonPassSalePhase,
              stats: seasonPassStats,
            }}
          />
          <MatchManagementCard
            href="/admin/ticket-settings"
            title="ตั้งค่าจำนวนตั๋วต่อรายการ"
            description="กำหนดจำนวนสูงสุดต่อคำสั่งซื้อสำหรับตั๋วรายแมตช์และบัตรรายปี"
            className="border-violet-200 bg-violet-50 hover:border-violet-400"
          />
        </div>
      </div>
    );
  }

  const matches = await prisma.match.findMany({
    where: competition
      ? {
          competitionType: competition,
          OR: [
            { homeTeam: { contains: "Pattani", mode: "insensitive" } },
            { awayTeam: { contains: "Pattani", mode: "insensitive" } },
            { homeTeam: { contains: "ปัตตานี" } },
            { awayTeam: { contains: "ปัตตานี" } },
          ],
        }
      : undefined,
    orderBy: { kickoffAt: "asc" },
  });
  const availabilityByMatch = await getSeatAvailabilityForMatches(matches);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/matches" className="text-sm text-slate-500 hover:text-slate-900">← เลือกประเภทการแข่งขัน</Link>
          <h1 className="mt-1 text-xl font-bold">จัดการแมตช์{competitionLabel[competition]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/matches/new?competition=${competition}`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + เพิ่มแมตช์
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {matches.map((m) => (
          <article key={m.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <TeamBadge logo={m.homeTeamLogo} name={m.homeTeam} />
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-500">vs</span>
                  <TeamBadge logo={m.awayTeamLogo} name={m.awayTeam} />
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 md:text-base">
                  <MapPin className="size-4 shrink-0 text-slate-400" />
                  <span>{m.venue ?? "ยังไม่กำหนดสนาม"}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                <MatchDetail label="ประเภท">
                  <span className="flex flex-wrap gap-1.5">
                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                      {competitionLabel[m.competitionType] ?? m.competitionType}
                    </span>
                    {m.seasonPassEligible && (
                      <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800">
                        ใช้บัตรรายปีได้
                      </span>
                    )}
                  </span>
                </MatchDetail>
                <MatchDetail label="วันและเวลา" className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <CalendarDays className="size-4 shrink-0 text-slate-400" />
                    {m.kickoffAt ? formatDateTime(m.kickoffAt) : "ยังไม่กำหนด"}
                  </span>
                </MatchDetail>
                <MatchDetail label="สถานะ">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassName[m.status] ?? statusClassName.SCHEDULED}`}>
                    {statusLabel[m.status] ?? m.status}
                  </span>
                </MatchDetail>
              </div>

              <div className="flex items-center gap-2 lg:justify-end">
                <Link
                  href={`/admin/matches/${m.id}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  แก้ไข
                </Link>
                <DeleteMatchButton matchId={m.id} />
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold text-slate-800">จำนวนคงเหลือรายโซน</h2>
                <p className="text-xs text-slate-500">จำนวนคงเหลือ / ความจุทั้งหมด</p>
              </div>
              <ZoneAvailabilityGrid availability={availabilityByMatch.get(m.id)} />
            </div>
          </article>
        ))}
        {matches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            ยังไม่มีแมตช์ — เริ่มเพิ่มได้เลย
          </div>
        )}
      </div>
    </div>
  );
}

function MatchManagementCard({
  href,
  title,
  description,
  className,
  saleControl,
  seasonPassControl,
}: {
  href: string;
  title: string;
  description: string;
  className: string;
  saleControl?: {
    type: "LEAGUE";
    isOpen: boolean;
  };
  seasonPassControl?: {
    phase: "STAFF_ONLY" | "PUBLIC_OPEN" | "CLOSED";
    stats: { total: number; staffBooked: number; onlineBooked: number; remaining: number };
  };
}) {
  return (
    <article className={`rounded-xl border p-6 shadow-sm transition ${className}`}>
      <Link href={href} className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <span className="mt-5 inline-block text-sm font-semibold text-slate-800">เข้าสู่การจัดการ →</span>
      </Link>
      {saleControl && (
        <BookingSaleToggle
          saleType={saleControl.type}
          initialOpen={saleControl.isOpen}
        />
      )}
      {seasonPassControl && (
        <SeasonPassSalePhaseControl
          initialPhase={seasonPassControl.phase}
          stats={seasonPassControl.stats}
        />
      )}
    </article>
  );
}

function MatchDetail({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 ${className}`}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ZoneAvailabilityGrid({
  availability,
}: {
  availability?: Record<StadiumZoneCode, ZoneAvailability>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10">
      {STADIUM_ZONE_CODES.map((code) => {
        const zone = availability?.[code];
        return (
          <div
            key={code}
            title={zone
              ? `จองรายแมตช์ ${zone.matchBooked}${zone.sharedCapacity ? " · ใช้โควตาร่วมเดิม" : ""}`
              : undefined}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-center text-sm shadow-sm"
          >
            <p className="text-xs font-bold text-slate-500">โซน {code}</p>
            <p className="mt-0.5 text-base font-black text-emerald-700">
              {zone?.capacity == null
                ? "—"
                : `${zone.remaining.toLocaleString("th-TH")} / ${zone.capacity.toLocaleString("th-TH")}`}
            </p>
            {zone?.sharedCapacity && <p className="text-[11px] text-slate-500">โควตาร่วม</p>}
          </div>
        );
      })}
    </div>
  );
}

function TeamBadge({ logo, name }: { logo: string | null; name: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={40}
            height={40}
            unoptimized
            className="size-full p-1 object-contain"
          />
        ) : (
          <Shield className="size-5 text-slate-400" />
        )}
      </span>
      <span className="font-bold text-slate-900">{name}</span>
    </span>
  );
}
