import Image from "next/image";
import Link from "next/link";
import { Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getSeatAvailabilityForMatches, type ZoneAvailability } from "@/lib/seat-availability";
import { STADIUM_ZONE_CODES, type StadiumZoneCode } from "@/lib/stadium-zones";
import DeleteMatchButton from "./DeleteMatchButton";

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

export default async function AdminMatchesPage(props: {
  searchParams: Promise<{ competition?: string }>;
}) {
  await verifyPermission("MATCHES");
  const { competition: rawCompetition } = await props.searchParams;
  const competition = rawCompetition === "CUP" || rawCompetition === "LEAGUE"
    ? rawCompetition
    : undefined;

  if (!competition) {
    return (
      <div>
        <h1 className="text-xl font-bold">จัดการแมตช์</h1>
        <p className="mt-1 text-sm text-slate-600">เลือกประเภทการแข่งขันที่ต้องการจัดการ</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <MatchManagementCard
            href="/admin/matches?competition=LEAGUE"
            title="จัดการแมตช์บอลลีก"
            description="เพิ่ม แก้ไข และดูรายการแมตช์ฟุตบอลลีก"
            className="border-emerald-200 bg-emerald-50 hover:border-emerald-400"
          />
          <MatchManagementCard
            href="/admin/matches?competition=CUP"
            title="จัดการแมตช์บอลถ้วย"
            description="เพิ่ม แก้ไข และดูรายการแมตช์ฟุตบอลถ้วย"
            className="border-amber-200 bg-amber-50 hover:border-amber-400"
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

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm md:text-base">
          <thead className="border-b bg-slate-50 text-sm uppercase md:text-base">
            <tr>
              <th className="px-3 py-2 text-left">แมตช์</th>
              <th className="px-3 py-2 text-left">ประเภท</th>
              <th className="px-3 py-2 text-left">เวลา</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="min-w-[720px] px-3 py-3 text-left">คงเหลือรายโซน / ความจุ</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TeamBadge logo={m.homeTeamLogo} name={m.homeTeam} />
                    <span className="text-xs text-slate-400">vs</span>
                    <TeamBadge logo={m.awayTeamLogo} name={m.awayTeam} />
                  </div>
                  <div className="mt-1 text-sm text-slate-500 md:text-base">{m.venue ?? "— ยังไม่กำหนดสนาม"}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                    {competitionLabel[m.competitionType] ?? m.competitionType}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm md:text-base">
                  {m.kickoffAt ? formatDateTime(m.kickoffAt) : <span className="text-slate-400">— ยังไม่กำหนด</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {statusLabel[m.status] ?? m.status}
                  </span>
                </td>
                <ZoneAvailabilityCell availability={availabilityByMatch.get(m.id)} />
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/matches/${m.id}`}
                      className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      แก้ไข
                    </Link>
                    <DeleteMatchButton matchId={m.id} />
                  </div>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  ยังไม่มีแมตช์ — เริ่มเพิ่มได้เลย
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchManagementCard({
  href,
  title,
  description,
  className,
}: {
  href: string;
  title: string;
  description: string;
  className: string;
}) {
  return (
    <Link href={href} className={`rounded-xl border p-6 shadow-sm transition ${className}`}>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <span className="mt-5 inline-block text-sm font-semibold text-slate-800">เข้าสู่การจัดการ →</span>
    </Link>
  );
}

function ZoneAvailabilityCell({
  availability,
}: {
  availability?: Record<StadiumZoneCode, ZoneAvailability>;
}) {
  return (
    <td className="px-3 py-2">
      <div className="grid grid-cols-5 gap-2">
        {STADIUM_ZONE_CODES.map((code) => {
          const zone = availability?.[code];
          return (
            <div
              key={code}
              title={zone
                ? `จองรายแมตช์ ${zone.matchBooked} · บัตรรายปี ${zone.seasonReserved}${zone.sharedCapacity ? " · ใช้โควตาร่วมเดิม" : ""}`
                : undefined}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-sm"
            >
              <p className="font-bold text-slate-700">โซน {code}</p>
              <p className="mt-0.5 text-base font-bold text-emerald-700">
                {zone?.capacity == null
                  ? "—"
                  : `${zone.remaining.toLocaleString("th-TH")} / ${zone.capacity.toLocaleString("th-TH")}`}
              </p>
              {zone && zone.seasonReserved > 0 && (
                <p className="text-xs font-semibold text-amber-700">รายปี {zone.seasonReserved}</p>
              )}
              {zone?.sharedCapacity && <p className="text-xs text-slate-500">โควตาร่วม</p>}
            </div>
          );
        })}
      </div>
    </td>
  );
}

function TeamBadge({ logo, name }: { logo: string | null; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex size-6 items-center justify-center overflow-hidden rounded bg-slate-100">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={24}
            height={24}
            unoptimized
            className="size-full object-contain"
          />
        ) : (
          <Shield className="size-3.5 text-slate-400" />
        )}
      </span>
      <span className="font-medium">{name}</span>
    </span>
  );
}
