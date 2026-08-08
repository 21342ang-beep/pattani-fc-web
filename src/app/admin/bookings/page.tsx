import { prisma } from "@/lib/prisma";
import { expirePendingBookings } from "@/lib/booking-expiry";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";
import Link from "next/link";
import BookingStatusSelect from "./BookingStatusSelect";
import DeleteBookingButton from "./DeleteBookingButton";
import DeleteAllBookingsButton from "./DeleteAllBookingsButton";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  REFUNDED: "bg-blue-100 text-blue-800",
};

export default async function AdminBookingsPage(props: { searchParams: Promise<{ price?: string; name?: string }> }) {
  await verifyPermission("BOOKINGS");
  const { price: rawPrice, name: rawName } = await props.searchParams;
  const selectedPrice = rawPrice && /^\d+$/.test(rawPrice) ? Number(rawPrice) : null;
  const customerName = rawName?.trim().slice(0, 100) ?? "";
  await expirePendingBookings();
  const allBookings = await prisma.booking.findMany({
    where: customerName ? { customerName: { contains: customerName, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    include: { match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } } },
    take: 100,
  });
  const priceGroups = new Map<number, { bookings: number; tickets: number }>();
  const awayZoneSummary = { bookings: 0, tickets: 0 };
  for (const booking of allBookings) {
    if (booking.zone === "AWAY") {
      awayZoneSummary.bookings += 1;
      awayZoneSummary.tickets += booking.quantity;
    }
    const price = booking.quantity > 0 ? booking.totalAmount / booking.quantity : null;
    if (price == null || !Number.isInteger(price)) continue;
    const current = priceGroups.get(price) ?? { bookings: 0, tickets: 0 };
    current.bookings += 1;
    current.tickets += booking.quantity;
    priceGroups.set(price, current);
  }
  const bookings = selectedPrice == null
    ? allBookings
    : allBookings.filter((booking) => booking.quantity > 0 && booking.totalAmount / booking.quantity === selectedPrice);
  const filtersActive = selectedPrice != null || customerName !== "";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-green-900 md:text-4xl">การจอง</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings/check"
            className="rounded-md border border-green-200 bg-white px-3 py-2 text-base font-medium text-green-900 hover:bg-green-50 md:text-lg"
          >
            🎫 สแกนและประวัติการใช้งานบัตร
          </Link>
          <a
            href="/api/admin/bookings/export"
            className="rounded-md border border-green-200 bg-white px-3 py-2 text-base font-medium text-green-900 hover:bg-green-50 md:text-lg"
          >
            ⬇ ส่งออก CSV
          </a>
          <DeleteAllBookingsButton />
        </div>
      </div>
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-green-100 bg-white p-4 shadow-sm">
        {selectedPrice != null && <input type="hidden" name="price" value={selectedPrice} />}
        <label className="min-w-64 flex-1">
          <span className="block text-base font-semibold text-green-900 md:text-lg">ค้นหาชื่อลูกค้า</span>
          <input
            name="name"
            type="search"
            defaultValue={customerName}
            placeholder="พิมพ์ชื่อผู้จอง"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-lg"
          />
        </label>
        <button type="submit" className="rounded-md bg-green-800 px-4 py-2.5 text-base font-semibold text-yellow-300 hover:bg-green-900 md:text-lg">
          ค้นหา
        </button>
        {filtersActive && <Link href="/admin/bookings" className="rounded-md border border-slate-300 px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 md:text-lg">ล้างตัวกรอง</Link>}
      </form>
      {priceGroups.size > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-green-900 md:text-3xl">ประเภทการจองตามราคา</h2>
            {filtersActive && <Link href={`/admin/bookings${customerName ? `?name=${encodeURIComponent(customerName)}` : ""}`} className="text-base font-medium text-green-800 hover:underline md:text-lg">แสดงทั้งหมด</Link>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...priceGroups.entries()].sort(([a], [b]) => a - b).map(([price, summary]) => (
              <Link key={price} href={`/admin/bookings?price=${price}${customerName ? `&name=${encodeURIComponent(customerName)}` : ""}`} className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedPrice === price ? "border-yellow-400 bg-yellow-50" : "border-green-100 bg-white"}`}>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500 md:text-base">ราคาต่อใบ</p>
                <p className="mt-1 text-3xl font-black text-green-900 md:text-4xl">{formatBaht(price)}</p>
                <p className="mt-2 text-base text-slate-600 md:text-lg">{summary.bookings} รายการ · {summary.tickets} ใบ</p>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="mb-6">
        <h2 className="mb-3 text-2xl font-bold text-green-900 md:text-3xl">ข้อมูลการจองโซนทีมเยือน</h2>
        <div className="max-w-sm rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-violet-700 md:text-base">โซนทีมเยือน</p>
          <p className="mt-1 text-3xl font-black text-violet-950 md:text-4xl">{awayZoneSummary.tickets} ใบ</p>
          <p className="mt-2 text-base text-violet-800 md:text-lg">{awayZoneSummary.bookings} รายการจอง</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full min-w-[1050px] text-base md:text-lg">
          <thead className="border-b bg-slate-50 text-sm uppercase md:text-base">
            <tr>
              <th className="px-3 py-2 text-left">รหัส</th>
              <th className="px-3 py-2 text-left">ลูกค้า</th>
              <th className="px-3 py-2 text-left">แมตช์</th>
              <th className="px-3 py-2 text-right">จำนวน</th>
              <th className="px-3 py-2 text-right">ยอด</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="px-3 py-2 text-left">วันที่</th>
              <th className="px-3 py-2 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-sm md:text-base">{b.bookingCode}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{b.customerName}</div>
                  <div className="text-sm text-slate-500 md:text-base">{b.customerEmail}</div>
                  <div className="text-sm text-slate-500 md:text-base">{b.customerPhone}</div>
                </td>
                <td className="px-3 py-2 text-base md:text-lg">
                  <div>{b.match.homeTeam} vs {b.match.awayTeam}</div>
                  <div className="text-slate-500">
                    {b.match.kickoffAt ? formatDateTime(b.match.kickoffAt) : "—"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">{b.quantity}</td>
                <td className="px-3 py-2 text-right">{formatBaht(b.totalAmount)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-sm ${statusColor[b.status]}`}>
                      {b.status}
                    </span>
                    <BookingStatusSelect bookingId={b.id} currentStatus={b.status} />
                  </div>
                </td>
                <td className="px-3 py-2 text-sm text-slate-500 md:text-base">
                  {formatDateTime(b.createdAt)}
                </td>
                <td className="px-3 py-2 text-right">
                  <DeleteBookingButton
                    bookingId={b.id}
                    bookingCode={b.bookingCode}
                    status={b.status}
                  />
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">
                  ยังไม่มีการจอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
