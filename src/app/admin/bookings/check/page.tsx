import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDateTime } from "@/lib/format";
import CheckForm from "./CheckForm";
import DeleteBookingGateScanButton from "./DeleteBookingGateScanButton";

export const metadata = { title: "ตรวจสอบการจอง — Pattani FC Admin" };

export default async function CheckBookingPage(props: {
  searchParams: Promise<{ match?: string; price?: string }>;
}) {
  await verifyPermission("BOOKINGS");
  const { match: rawMatchId, price: rawPrice } = await props.searchParams;
  const [matches, scans, bookingPrices] = await Promise.all([
    prisma.match.findMany({
      where: { bookings: { some: {} } },
      orderBy: [{ kickoffAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: { id: true, homeTeam: true, awayTeam: true, kickoffAt: true },
    }),
    prisma.bookingGateScan.findMany({
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
            quantity: true,
            totalAmount: true,
            match: { select: { id: true, homeTeam: true, awayTeam: true } },
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED" },
      select: { matchId: true, quantity: true, totalAmount: true },
    }),
  ]);

  const selectedMatchId = matches.some((match) => match.id === rawMatchId) ? rawMatchId! : matches[0]?.id;
  const selectedMatch = matches.find((match) => match.id === selectedMatchId);
  const priceOptions = selectedMatchId
    ? [...new Set(bookingPrices
      .filter((booking) => booking.matchId === selectedMatchId && booking.quantity > 0)
      .map((booking) => booking.totalAmount / booking.quantity))].sort((a, b) => a - b)
    : [];
  const parsedPrice = Number(rawPrice);
  const selectedPrice = priceOptions.includes(parsedPrice) ? parsedPrice : priceOptions[0];
  const matchScans = selectedMatchId ? scans.filter((scan) => scan.booking.match.id === selectedMatchId) : [];
  const displayedScans = selectedPrice === undefined
    ? matchScans
    : matchScans.filter((scan) => scan.booking.quantity > 0 && scan.booking.totalAmount / scan.booking.quantity === selectedPrice);

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
              const scanCount = scans.filter((scan) => scan.booking.match.id === match.id).length;
              const isSelected = match.id === selectedMatchId;
              return (
                <Link
                  key={match.id}
                  href={`/admin/bookings/check?match=${match.id}`}
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
              <p className="text-base text-slate-600 md:text-lg">เลือกประเภทราคาบัตรเพื่อดูและตรวจสอบรายการได้สะดวกขึ้น</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1.5 text-base font-semibold text-green-800 md:text-lg">สแกนแล้ว {displayedScans.length.toLocaleString("th-TH")} ครั้ง</span>
          </div>

          {priceOptions.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="ราคาบัตร">
              {priceOptions.map((price) => {
                const isSelected = price === selectedPrice;
                const ticketCount = bookingPrices
                  .filter((booking) => booking.matchId === selectedMatchId && booking.quantity > 0 && booking.totalAmount / booking.quantity === price)
                  .reduce((sum, booking) => sum + booking.quantity, 0);
                return (
                  <Link
                    key={price}
                    href={`/admin/bookings/check?match=${selectedMatchId}&price=${price}`}
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

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[900px] text-base md:text-lg">
              <thead className="border-b bg-slate-50 text-left text-sm uppercase text-slate-600 md:text-base">
                <tr><th className="px-3 py-2">เวลาสแกน</th><th className="px-3 py-2">รหัสการจอง</th><th className="px-3 py-2">ผู้จอง</th><th className="px-3 py-2">ผู้สแกน</th><th className="px-3 py-2 text-right">ทดสอบ</th></tr>
              </thead>
              <tbody>
                {displayedScans.map((scan) => (
                  <tr key={scan.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDateTime(scan.scannedAt)}</td>
                    <td className="px-3 py-2 font-mono text-sm md:text-base">{scan.booking.bookingCode}</td>
                    <td className="px-3 py-2 font-medium">{scan.booking.customerName}</td>
                    <td className="px-3 py-2 font-mono text-sm text-slate-500 md:text-base">{scan.scannedBy}</td>
                    <td className="px-3 py-2 text-right"><DeleteBookingGateScanButton scanId={scan.id} /></td>
                  </tr>
                ))}
                {displayedScans.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">ยังไม่มีข้อมูลการสแกนของราคาบัตรนี้</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
