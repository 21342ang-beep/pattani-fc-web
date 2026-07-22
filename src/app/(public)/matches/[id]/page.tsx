import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMatchById } from "@/lib/cached-queries";
import { readCustomerSession } from "@/lib/customer-session";
import { formatBaht, formatDateTime } from "@/lib/format";
import BookingForm from "./BookingForm";
import { getStadiumZone, getZoneCapacity, getZonePriceGroup, getZonesForPriceGroup, type StadiumZoneCode } from "@/lib/stadium-zones";

// whitelist โซน — กัน XSS ผ่าน URL
const ALLOWED_ZONES = [
  "A1", "A2", "B", "C", "D", "E", "G", "AWAY",
] as const;

export default async function MatchDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zone?: string }>;
}) {
  const { id } = await props.params;
  const { zone: zoneRaw } = await props.searchParams;
  const zone = (ALLOWED_ZONES as readonly string[]).includes(zoneRaw ?? "")
    ? zoneRaw
    : undefined;
  const selectedZone = getStadiumZone(zone);

  const [match, session, sold] = await Promise.all([
    getMatchById(id),
    readCustomerSession(),
    zone && getZonePriceGroup(zone as StadiumZoneCode)
      ? prisma.booking.aggregate({
          where: {
            matchId: id,
            zone: { in: getZonesForPriceGroup(getZonePriceGroup(zone as StadiumZoneCode)!) },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          _sum: { quantity: true },
        })
      : Promise.resolve({ _sum: { quantity: 0 } }),
  ]);
  if (!match) notFound();

  const capacity = zone ? getZoneCapacity(match, zone as StadiumZoneCode) : null;
  const remaining = capacity != null ? capacity - (sold._sum.quantity ?? 0) : 0;
  const canBook =
    match.status === "ON_SALE" &&
    remaining > 0 &&
    selectedZone != null &&
    match.kickoffAt != null &&
    capacity != null;

  // โหลด customer (name/phone default ใน form) — ถ้ามี session
  const customer = session
    ? await prisma.customer.findUnique({
        where: { id: session.customerId },
        select: { name: true, phone: true },
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/matches" className="text-sm text-slate-500 hover:text-slate-900">
        ← กลับตารางแข่งขัน
      </Link>

      <article className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">
          {match.homeTeam} <span className="text-slate-400">vs</span> {match.awayTeam}
        </h1>
        {zone && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-900">
            โซนที่เลือก: {zone}
          </p>
        )}
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 text-slate-500">สนาม</dt>
            <dd>{match.venue ?? <span className="text-slate-400">ยังไม่กำหนด</span>}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-slate-500">เวลา</dt>
            <dd>
              {match.kickoffAt ? (
                formatDateTime(match.kickoffAt)
              ) : (
                <span className="text-slate-400">ยังไม่กำหนด</span>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-slate-500">ราคา</dt>
            <dd>
              {selectedZone ? (
                `${formatBaht(selectedZone.priceSatang)} / ใบ`
              ) : (
                <span className="text-slate-400">เลือกโซนเพื่อดูราคา</span>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-slate-500">เหลือ</dt>
            <dd>
              {capacity != null
                ? `${remaining.toLocaleString("th-TH")} ที่นั่ง`
                : "ยังไม่กำหนด"}
            </dd>
          </div>
        </dl>
        {match.description && (
          <p className="mt-4 text-sm text-slate-700">{match.description}</p>
        )}
      </article>

      {!selectedZone ? (
        <div className="mt-6 rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
          กรุณาเลือกโซนที่นั่งก่อนจอง <Link href="/tickets" className="font-semibold underline">เลือกโซน</Link>
        </div>
      ) : !canBook ? (
        <div className="mt-6 rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
          ขณะนี้ยังไม่เปิดจอง หรือที่นั่งเต็มแล้ว
        </div>
      ) : (
        <BookingForm
          matchId={match.id}
          pricePerSeat={selectedZone!.priceSatang}
          maxQuantity={Math.min(10, remaining)}
          customerEmail={session?.email ?? null}
          customerName={customer?.name ?? session?.name ?? ""}
          customerPhone={customer?.phone ?? ""}
          zone={zone}
        />
      )}
    </div>
  );
}
