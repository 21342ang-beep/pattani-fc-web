import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDateTime } from "@/lib/format";
import {
  ALL_SCAN_ZONES,
  UNASSIGNED_SCAN_ZONE,
  buildScanZoneSummaries,
  resolveSelectedScanZone,
  scanZoneKey,
  scanZoneMatches,
} from "@/lib/scan-zone-summary";
import CheckForm from "./CheckForm";
import DeleteBookingGateScanButton from "./DeleteBookingGateScanButton";

export const metadata = { title: "ตรวจสอบการจอง — Pattani FC Admin" };

function bookingUnitPrice(booking: { quantity: number; totalAmount: number }) {
  return booking.quantity > 0 ? booking.totalAmount / booking.quantity : null;
}

function zoneLabel(zone: string) {
  return zone === UNASSIGNED_SCAN_ZONE ? "ไม่ระบุโซน" : `โซน ${zone}`;
}

function bookingCheckHref(matchId: string, price?: number, zone?: string) {
  const params = new URLSearchParams({ match: matchId });
  if (price !== undefined) params.set("price", String(price));
  if (zone && zone !== ALL_SCAN_ZONES) params.set("zone", zone);
  return `/admin/bookings/check?${params.toString()}`;
}

export default async function CheckBookingPage(props: {
  searchParams: Promise<{ match?: string; price?: string; zone?: string }>;
}) {
  await verifyPermission("BOOKINGS");
  const { match: rawMatchId, price: rawPrice, zone: rawZone } = await props.searchParams;
  const [matches, bookingStats] = await Promise.all([
    prisma.match.findMany({
      where: { bookings: { some: {} } },
      orderBy: [{ kickoffAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: { id: true, homeTeam: true, awayTeam: true, kickoffAt: true },
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          { status: "CONFIRMED" },
          { gateScans: { some: {} } },
        ],
      },
      select: {
        id: true,
        matchId: true,
        status: true,
        quantity: true,
        totalAmount: true,
        zone: true,
        _count: { select: { gateScans: true } },
      },
    }),
  ]);

  const selectedMatchId = matches.some((match) => match.id === rawMatchId) ? rawMatchId! : matches[0]?.id;
  const selectedMatch = matches.find((match) => match.id === selectedMatchId);
  const selectedMatchBookings = selectedMatchId
    ? bookingStats.filter((booking) => booking.matchId === selectedMatchId)
    : [];
  const priceOptions = selectedMatchId
    ? [...new Set(selectedMatchBookings
      .filter((booking) => booking.status === "CONFIRMED")
      .map(bookingUnitPrice)
      .filter((price): price is number => price !== null))].sort((a, b) => a - b)
    : [];
  const parsedPrice = Number(rawPrice);
  const selectedPrice = priceOptions.includes(parsedPrice) ? parsedPrice : priceOptions[0];
  const selectedPriceBookings = selectedPrice === undefined
    ? selectedMatchBookings.filter((booking) => booking._count.gateScans > 0)
    : selectedMatchBookings.filter((booking) => bookingUnitPrice(booking) === selectedPrice);
  const zoneSummaries = buildScanZoneSummaries(
    selectedPriceBookings
      .filter((booking) => booking.status === "CONFIRMED" || booking._count.gateScans > 0)
      .map((booking) => ({
        zone: booking.zone,
        scans: booking._count.gateScans,
        total: booking.status === "CONFIRMED" ? booking.quantity : 0,
      })),
  );
  const selectedZone = resolveSelectedScanZone(rawZone, zoneSummaries.map((summary) => summary.zone));
  const displayedBookings = selectedPriceBookings.filter((booking) => scanZoneMatches(booking.zone, selectedZone));
  const displayedScanCount = displayedBookings.reduce((sum, booking) => sum + booking._count.gateScans, 0);
  const displayedBookingIds = displayedBookings.map((booking) => booking.id);
  const displayedScans = displayedBookingIds.length > 0
    ? await prisma.bookingGateScan.findMany({
      where: { bookingId: { in: displayedBookingIds } },
      orderBy: { scannedAt: "desc" },
      take: 100,
      select: {
        id: true,
        scannedAt: true,
        scannedBy: true,
        booking: {
          select: {
            bookingCode: true,
            customerName: true,
            zone: true,
          },
        },
      },
    })
    : [];
  const allZoneScans = zoneSummaries.reduce((sum, summary) => sum + summary.scans, 0);
  const allZoneTickets = zoneSummaries.reduce((sum, summary) => sum + summary.total, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <Link href="/admin/bookings" className="text-base font-medium text-green-800 hover:underline md:text-lg">
          ← กลับไปหน้าการจอง
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-green-900 md:text-4xl">สแกนใช้งานตั๋ว</h1>
        <p className="text-base text-slate-600 md:text-lg">ยิงบาร์โค้ดเพื่อบันทึกการใช้งานและตรวจสอบสิทธิ์เข้าชมการแข่งขัน</p>
      </header>

      <CheckForm />

      <section>
        <h2 className="mb-3 text-2xl font-bold text-green-900 md:text-3xl">ข้อมูลการสแกนแยกตามแมตช์</h2>
        {matches.length === 0 ? (
          <p className="rounded-xl border bg-white p-5 text-base text-slate-500 shadow-sm md:text-lg">ยังไม่มีแมตช์ที่มีข้อมูลการจอง</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="แมตช์การแข่งขัน">
            {matches.map((match) => {
              const scanCount = bookingStats
                .filter((booking) => booking.matchId === match.id)
                .reduce((sum, booking) => sum + booking._count.gateScans, 0);
              const isSelected = match.id === selectedMatchId;
              return (
                <Link
                  key={match.id}
                  href={bookingCheckHref(match.id)}
                  role="tab"
                  aria-selected={isSelected}
                  className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-700/30 ${
                    isSelected ? "border-green-700 bg-green-50 ring-2 ring-green-700/20" : "border-green-100 bg-white"
                  }`}
                >
                  <p className="text-base font-bold text-green-900 md:text-lg">{match.homeTeam} vs {match.awayTeam}</p>
                  <p className="mt-1 text-sm text-slate-600 md:text-base">{match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่งขัน"}</p>
                  <p className="mt-3 text-2xl font-black text-green-900 md:text-3xl">{scanCount.toLocaleString("th-TH")} <span className="text-base font-medium md:text-lg">ครั้งที่สแกน</span></p>
                  <p className="mt-1 text-sm font-semibold text-green-800 md:text-base">ดูประวัติแมตช์นี้</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {selectedMatch && (
        <section className="rounded-xl border bg-white p-5 shadow-sm" role="tabpanel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-green-900 md:text-3xl">ประวัติการสแกน · {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</h2>
              <p className="text-base text-slate-600 md:text-lg">เลือกประเภทราคาบัตรและโซนเพื่อดูรายการสแกนจริงแยกตามจุดเข้า</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1.5 text-base font-semibold text-green-800 md:text-lg">สแกนแล้ว {displayedScanCount.toLocaleString("th-TH")} ครั้ง</span>
          </div>

          {priceOptions.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="ราคาบัตร">
              {priceOptions.map((price) => {
                const isSelected = price === selectedPrice;
                const ticketCount = selectedMatchBookings
                  .filter((booking) => booking.status === "CONFIRMED" && bookingUnitPrice(booking) === price)
                  .reduce((sum, booking) => sum + booking.quantity, 0);
                return (
                  <Link
                    key={price}
                    href={bookingCheckHref(selectedMatch.id, price)}
                    role="tab"
                    aria-selected={isSelected}
                    className={`rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-700/30 ${
                      isSelected ? "border-green-700 bg-green-50 ring-2 ring-green-700/20" : "border-green-100 bg-white"
                    }`}
                  >
                    <p className="text-sm font-bold tracking-wider text-yellow-700 md:text-base">ราคาบัตร</p>
                    <p className="mt-2 text-2xl font-black text-green-900 md:text-3xl">{formatBaht(price)}</p>
                    <p className="text-base text-slate-600 md:text-lg">จำนวน {ticketCount.toLocaleString("th-TH")} ใบ</p>
                    <p className="mt-2 text-sm font-semibold text-green-800 md:text-base">ดูประวัติราคานี้</p>
                  </Link>
                );
              })}
            </div>
          )}

          {selectedPrice !== undefined && zoneSummaries.length > 0 && (
            <div className="mt-5">
              <h3 className="text-lg font-bold text-green-900 md:text-xl">บัตรที่สแกนแล้วแยกตามโซน</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="โซนที่นั่ง">
                <Link
                  href={bookingCheckHref(selectedMatch.id, selectedPrice)}
                  role="tab"
                  aria-selected={selectedZone === ALL_SCAN_ZONES}
                  className={`rounded-xl border p-4 shadow-sm transition hover:border-green-400 hover:bg-green-50/50 focus:outline-none focus:ring-2 focus:ring-green-700/30 ${
                    selectedZone === ALL_SCAN_ZONES ? "border-green-700 bg-green-50 ring-2 ring-green-700/20" : "border-green-100 bg-white"
                  }`}
                >
                  <p className="font-bold text-green-900">ทุกโซน</p>
                  <p className="mt-2 text-2xl font-black text-green-900">{allZoneScans.toLocaleString("th-TH")} <span className="text-sm font-medium">ครั้ง</span></p>
                  <p className="text-sm text-slate-600">บัตรยืนยัน {allZoneTickets.toLocaleString("th-TH")} ใบ</p>
                </Link>
                {zoneSummaries.map((summary) => (
                  <Link
                    key={summary.zone}
                    href={bookingCheckHref(selectedMatch.id, selectedPrice, summary.zone)}
                    role="tab"
                    aria-selected={selectedZone === summary.zone}
                    className={`rounded-xl border p-4 shadow-sm transition hover:border-green-400 hover:bg-green-50/50 focus:outline-none focus:ring-2 focus:ring-green-700/30 ${
                      selectedZone === summary.zone ? "border-green-700 bg-green-50 ring-2 ring-green-700/20" : "border-green-100 bg-white"
                    }`}
                  >
                    <p className="font-bold text-green-900">{zoneLabel(summary.zone)}</p>
                    <p className="mt-2 text-2xl font-black text-green-900">{summary.scans.toLocaleString("th-TH")} <span className="text-sm font-medium">ครั้ง</span></p>
                    <p className="text-sm text-slate-600">บัตรยืนยัน {summary.total.toLocaleString("th-TH")} ใบ</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1000px] text-base md:text-lg">
              <thead className="border-b bg-slate-50 text-left text-sm uppercase text-slate-600 md:text-base">
                <tr><th className="px-3 py-2">เวลาสแกน</th><th className="px-3 py-2">รหัสการจอง</th><th className="px-3 py-2">ผู้จอง</th><th className="px-3 py-2">โซน</th><th className="px-3 py-2">ผู้สแกน</th><th className="px-3 py-2 text-right">ทดสอบ</th></tr>
              </thead>
              <tbody>
                {displayedScans.map((scan) => (
                  <tr key={scan.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDateTime(scan.scannedAt)}</td>
                    <td className="px-3 py-2 font-mono text-sm md:text-base">{scan.booking.bookingCode}</td>
                    <td className="px-3 py-2 font-medium">{scan.booking.customerName}</td>
                    <td className="px-3 py-2 font-semibold">{zoneLabel(scanZoneKey(scan.booking.zone))}</td>
                    <td className="px-3 py-2 font-mono text-sm text-slate-500 md:text-base">{scan.scannedBy}</td>
                    <td className="px-3 py-2 text-right"><DeleteBookingGateScanButton scanId={scan.id} /></td>
                  </tr>
                ))}
                {displayedScans.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">ยังไม่มีข้อมูลการสแกนของราคาและโซนที่เลือก</td></tr>}
              </tbody>
            </table>
          </div>
          {displayedScanCount > displayedScans.length && (
            <p className="mt-2 text-sm text-slate-500 md:text-base">
              แสดง 100 รายการล่าสุดจากทั้งหมด {displayedScanCount.toLocaleString("th-TH")} ครั้งในตัวกรองนี้
            </p>
          )}
        </section>
      )}
    </div>
  );
}
