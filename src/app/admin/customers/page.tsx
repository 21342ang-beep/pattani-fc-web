import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "ลูกค้า — Pattani FC Admin" };

type SortKey = "spend" | "recent";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  await verifyPermission("CUSTOMERS");
  const sp = await searchParams;
  const sort: SortKey = sp.sort === "recent" ? "recent" : "spend";
  const q = (sp.q ?? "").trim().slice(0, 100);

  const paidBookingWhere: Prisma.BookingWhereInput = {
    status: "CONFIRMED",
    paidAt: { not: null },
  };
  const matchingPhones = q
    ? await prisma.booking.findMany({
        where: {
          ...paidBookingWhere,
          OR: [
            { customerEmail: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q } },
          ],
        },
        select: { customerPhone: true },
        distinct: ["customerPhone"],
      })
    : null;
  const matchedPhoneNumbers = matchingPhones?.map((row) => row.customerPhone);

  const grouped = matchedPhoneNumbers?.length === 0 ? [] : await prisma.booking.groupBy({
    by: ["customerPhone"],
    where: {
      ...paidBookingWhere,
      ...(matchedPhoneNumbers ? { customerPhone: { in: matchedPhoneNumbers } } : {}),
    },
    _sum: { totalAmount: true, quantity: true },
    _count: true,
    _max: { createdAt: true },
    orderBy:
      sort === "spend"
        ? { _sum: { totalAmount: "desc" } }
        : { _max: { createdAt: "desc" } },
    take: 100,
  });
  const latestBookings = grouped.length === 0 ? [] : await prisma.booking.findMany({
    where: {
      ...paidBookingWhere,
      customerPhone: { in: grouped.map((row) => row.customerPhone) },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["customerPhone"],
    select: {
      customerPhone: true,
      customerName: true,
      customerEmail: true,
    },
  });
  const latestBookingByPhone = new Map(
    latestBookings.map((booking) => [booking.customerPhone, booking]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">ลูกค้า</h1>
        <p className="text-sm text-slate-500">
          รวมเฉพาะรายการที่ยืนยันและชำระเงินแล้ว — แยกลูกค้าตามเบอร์โทรศัพท์
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาอีเมล / ชื่อ / เบอร์"
          className="rounded-md border border-green-200 px-3 py-1.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-md border border-green-200 px-3 py-1.5 text-sm outline-none focus:border-green-600"
        >
          <option value="spend">เรียงตามยอดชำระมากสุด</option>
          <option value="recent">เรียงตามจองล่าสุด</option>
        </select>
        <button className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-semibold text-yellow-300 hover:bg-green-900">
          ค้นหา
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-green-50 text-left text-xs uppercase text-green-900">
            <tr>
              <th className="px-3 py-2">ลูกค้า</th>
              <th className="px-3 py-2">ติดต่อ</th>
              <th className="px-3 py-2 text-right">การจอง</th>
              <th className="px-3 py-2 text-right">ใบทั้งหมด</th>
              <th className="px-3 py-2 text-right">ยอดชำระรวม</th>
              <th className="px-3 py-2">จองล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  ไม่พบลูกค้า
                </td>
              </tr>
            ) : (
              grouped.map((c) => {
                const latest = latestBookingByPhone.get(c.customerPhone);
                return (
                  <tr key={c.customerPhone} className="border-t">
                    <td className="px-3 py-2 font-medium text-green-900">
                      {latest?.customerName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <div>{latest?.customerEmail ?? "—"}</div>
                      <div>{c.customerPhone}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{c._count}</td>
                    <td className="px-3 py-2 text-right">
                      {c._sum.quantity ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatBaht(c._sum.totalAmount ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {c._max.createdAt ? formatDateTime(c._max.createdAt) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        แสดงได้สูงสุด 100 คน · นับเฉพาะรายการ CONFIRMED ที่มีเวลาชำระเงินแล้ว
      </p>
    </div>
  );
}
