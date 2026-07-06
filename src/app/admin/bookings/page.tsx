import { prisma } from "@/lib/prisma";
import { formatBaht, formatDateTime } from "@/lib/format";
import BookingStatusSelect from "./BookingStatusSelect";
import DeleteBookingButton from "./DeleteBookingButton";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  REFUNDED: "bg-blue-100 text-blue-800",
};

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: { match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } } },
    take: 100,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-green-900">การจอง</h1>
        <a
          href="/api/admin/bookings/export"
          className="rounded-md border border-green-200 bg-white px-3 py-1.5 text-sm font-medium text-green-900 hover:bg-green-50"
        >
          ⬇ ส่งออก CSV
        </a>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase">
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
                <td className="px-3 py-2 font-mono text-xs">{b.bookingCode.slice(0, 8)}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{b.customerName}</div>
                  <div className="text-xs text-slate-500">{b.customerEmail}</div>
                  <div className="text-xs text-slate-500">{b.customerPhone}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{b.match.homeTeam} vs {b.match.awayTeam}</div>
                  <div className="text-slate-500">
                    {b.match.kickoffAt ? formatDateTime(b.match.kickoffAt) : "—"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">{b.quantity}</td>
                <td className="px-3 py-2 text-right">{formatBaht(b.totalAmount)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${statusColor[b.status]}`}>
                      {b.status}
                    </span>
                    <BookingStatusSelect bookingId={b.id} currentStatus={b.status} />
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
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
