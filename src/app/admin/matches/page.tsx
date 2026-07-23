import Image from "next/image";
import Link from "next/link";
import { Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getStadiumZone } from "@/lib/stadium-zones";
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
    where: competition ? { competitionType: competition } : undefined,
    orderBy: { kickoffAt: "asc" },
    include: {
      bookings: {
        where: { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { zone: true, quantity: true },
      },
    },
  });

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
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">แมตช์</th>
              <th className="px-3 py-2 text-left">ประเภท</th>
              <th className="px-3 py-2 text-left">เวลา</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="px-3 py-2 text-right">150 บาท/จอง</th>
              <th className="px-3 py-2 text-right">120 บาท/จอง</th>
              <th className="px-3 py-2 text-right">100 บาท/จอง</th>
              <th className="px-3 py-2 text-right">AWAY 200/จอง</th>
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
                  <div className="mt-0.5 text-xs text-slate-500">{m.venue ?? "— ยังไม่กำหนดสนาม"}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                    {competitionLabel[m.competitionType] ?? m.competitionType}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {m.kickoffAt ? formatDateTime(m.kickoffAt) : <span className="text-slate-400">— ยังไม่กำหนด</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {statusLabel[m.status] ?? m.status}
                  </span>
                </td>
                <ZoneBookingCell capacity={m.zone150Seats} bookings={m.bookings} price={150} />
                <ZoneBookingCell capacity={m.zone120Seats} bookings={m.bookings} price={120} />
                <ZoneBookingCell capacity={m.zone100Seats} bookings={m.bookings} price={100} />
                <ZoneBookingCell capacity={m.zoneAwaySeats} bookings={m.bookings} zoneCode="AWAY" />
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
                <td colSpan={9} className="p-6 text-center text-slate-500">
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

function ZoneBookingCell({
  capacity,
  bookings,
  price,
  zoneCode,
}: {
  capacity: number | null;
  bookings: { zone: string | null; quantity: number }[];
  price?: 150 | 120 | 100;
  zoneCode?: "AWAY";
}) {
  const booked = bookings.reduce((sum, booking) => {
    if (zoneCode) return booking.zone === zoneCode ? sum + booking.quantity : sum;
    const zone = getStadiumZone(booking.zone);
    return zone && zone.priceSatang / 100 === price ? sum + booking.quantity : sum;
  }, 0);
  return (
    <td className="px-3 py-2 text-right text-xs">
      {capacity == null ? "—" : `${capacity.toLocaleString("th-TH")} / ${booked.toLocaleString("th-TH")}`}
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
