import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";

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

  const grouped = await prisma.booking.groupBy({
    by: ["customerEmail"],
    where: q
      ? {
          OR: [
            { customerEmail: { contains: q } },
            { customerName: { contains: q } },
            { customerPhone: { contains: q } },
          ],
        }
      : undefined,
    _sum: { totalAmount: true, quantity: true },
    _count: true,
    _max: { createdAt: true, customerName: true, customerPhone: true },
    orderBy:
      sort === "spend"
        ? { _sum: { totalAmount: "desc" } }
        : { _max: { createdAt: "desc" } },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">ลูกค้า</h1>
        <p className="text-sm text-slate-500">
          รวบรวมจากการจอง — เห็นลูกค้าประจำ และยอดซื้อรวม
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
          <option value="spend">เรียงตามยอดใช้จ่ายมากสุด</option>
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
              <th className="px-3 py-2 text-right">ยอดใช้รวม</th>
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
              grouped.map((c) => (
                <tr key={c.customerEmail} className="border-t">
                  <td className="px-3 py-2 font-medium text-green-900">
                    {c._max.customerName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <div>{c.customerEmail}</div>
                    <div>{c._max.customerPhone ?? "—"}</div>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        แสดงได้สูงสุด 100 รายการต่อหน้า · ยอดใช้รวมนับจากทุกสถานะ
      </p>
    </div>
  );
}
