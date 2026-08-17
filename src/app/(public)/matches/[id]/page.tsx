import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMatchById } from "@/lib/cached-queries";
import { readCustomerSession } from "@/lib/customer-session";
import { formatBaht, formatDateTime } from "@/lib/format";
import { getSeatAvailabilityForMatches } from "@/lib/seat-availability";
import BookingForm from "./BookingForm";
import { getStadiumZone, getZonePrice, type StadiumZoneCode } from "@/lib/stadium-zones";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import SeasonPassAnnouncementModal from "../../_components/SeasonPassAnnouncementModal";
import { activeBookingStatusWhere } from "@/lib/booking-expiry";

const ZONE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,19}$/;

export default async function MatchDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zone?: string }>;
}) {
  const { id } = await props.params;
  const { zone: zoneRaw } = await props.searchParams;
  const normalizedZone = zoneRaw?.trim().toUpperCase();
  const zone = normalizedZone && ZONE_CODE_PATTERN.test(normalizedZone)
    ? normalizedZone
    : undefined;

  const [match, session, purchaseSettings] = await Promise.all([
    getMatchById(id),
    readCustomerSession(),
    getTicketPurchaseSettings(),
  ]);
  if (!match) notFound();

  const dynamicZone = zone
    ? match.ticketZones.find((item) => item.code === zone)
    : undefined;
  const legacyZone = getStadiumZone(zone);
  const selectedZone = dynamicZone ?? legacyZone;

  const availabilityByMatch = await getSeatAvailabilityForMatches([match]);
  const selectedAvailability = zone && legacyZone && !dynamicZone
    ? availabilityByMatch.get(match.id)?.[zone as StadiumZoneCode]
    : undefined;
  const dynamicBooked = dynamicZone
    ? await prisma.booking.aggregate({
        where: { matchId: match.id, zone: dynamicZone.code, ...activeBookingStatusWhere() },
        _sum: { quantity: true },
      })
    : null;
  const selectedPrice = dynamicZone?.price ?? (zone && legacyZone
    ? getZonePrice(match, zone as StadiumZoneCode)
    : null);
  const capacity = dynamicZone?.capacity ?? selectedAvailability?.capacity ?? null;
  const remaining = dynamicZone
    ? Math.max(0, dynamicZone.capacity - (dynamicBooked?._sum.quantity ?? 0))
    : selectedAvailability?.remaining ?? 0;
  const canBook =
    match.status === "ON_SALE" &&
    (match.competitionType !== "LEAGUE" || purchaseSettings.leagueBookingOpen) &&
    remaining > 0 &&
    selectedZone != null &&
    selectedPrice != null &&
    selectedPrice > 0 &&
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
    <>
      <SeasonPassAnnouncementModal
        initiallyOpen={match.competitionType === "LEAGUE" && !purchaseSettings.leagueBookingOpen}
        ticketType="match"
      />
      <div className="mx-auto w-full max-w-3xl">
      <Link href="/matches" className="text-base text-slate-500 hover:text-slate-900 md:text-lg">
        ← กลับตารางแข่งขัน
      </Link>

      <article className="mt-4 rounded-lg border bg-white p-7 shadow-sm md:p-8">
        <h1 className="text-3xl font-bold leading-tight md:text-4xl">
          {match.homeTeam} <span className="text-slate-400">vs</span> {match.awayTeam}
        </h1>
        {zone && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-1.5 text-base font-bold text-yellow-900 md:text-lg">
            โซนที่เลือก: {dynamicZone?.name ?? zone}
          </p>
        )}
        <dl className="mt-5 grid gap-3 text-base md:text-lg">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-slate-500">สนาม</dt>
            <dd>{match.venue ?? <span className="text-slate-400">ยังไม่กำหนด</span>}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-slate-500">เวลา</dt>
            <dd>
              {match.kickoffAt ? (
                formatDateTime(match.kickoffAt)
              ) : (
                <span className="text-slate-400">ยังไม่กำหนด</span>
              )}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-slate-500">ราคา</dt>
            <dd>
              {selectedPrice != null ? (
                `${formatBaht(selectedPrice)} / ใบ`
              ) : (
                <span className="text-slate-400">เลือกโซนเพื่อดูราคา</span>
              )}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-slate-500">เหลือ</dt>
            <dd className="space-y-0.5">
              {capacity != null
                ? `${remaining.toLocaleString("th-TH")} ที่นั่ง`
                : "ยังไม่กำหนด"}
            </dd>
          </div>
        </dl>
        {match.description && (
          <p className="mt-5 text-base leading-relaxed text-slate-700 md:text-lg">{match.description}</p>
        )}
      </article>

      {!selectedZone ? (
        <div className="mt-6 rounded-lg border bg-amber-50 p-5 text-base text-amber-800 md:text-lg">
          กรุณาเลือกโซนที่นั่งก่อนจอง <Link href="/tickets" className="font-semibold underline">เลือกโซน</Link>
        </div>
      ) : !canBook ? (
        <div className="mt-6 rounded-lg border bg-amber-50 p-5 text-base text-amber-800 md:text-lg">
          {match.competitionType === "LEAGUE" && !purchaseSettings.leagueBookingOpen
            ? "ขณะนี้ปิดการจองตั๋วบอลลีกชั่วคราว"
            : "ขณะนี้ยังไม่เปิดจอง หรือที่นั่งเต็มแล้ว"}
        </div>
      ) : (
        <BookingForm
          matchId={match.id}
          pricePerSeat={selectedPrice!}
          maxQuantity={Math.min(purchaseSettings.matchMaxQuantity, remaining)}
          customerEmail={session?.email ?? null}
          customerName={customer?.name ?? session?.name ?? ""}
          customerPhone={customer?.phone ?? ""}
          zone={zone}
        />
      )}
      </div>
    </>
  );
}
