import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายงานยอดขาย — Pattani FC Admin" };

export default async function ReportsPage() {
  await verifyPermission("REPORTS");
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    confirmedAgg,
    pendingAgg,
    cancelledCount,
    refundedAgg,
    confirmedLast30,
    topMatchesRaw,
    statusBreakdown,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { totalAmount: true, quantity: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { status: "PENDING" },
      _sum: { totalAmount: true, quantity: true },
      _count: true,
    }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.booking.aggregate({
      where: { status: "REFUNDED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { status: "CONFIRMED", createdAt: { gte: thirtyDaysAgo } },
      _sum: { totalAmount: true, quantity: true },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ["matchId"],
      where: { status: { in: ["PENDING", "CONFIRMED"] } },
      _sum: { totalAmount: true, quantity: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  const matchIds = topMatchesRaw.map((m) => m.matchId);
  const matches = matchIds.length
    ? await prisma.match.findMany({
        where: { id: { in: matchIds } },
        select: { id: true, homeTeam: true, awayTeam: true, kickoffAt: true, totalSeats: true },
      })
    : [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-green-900">รายงานยอดขาย</h1>
        <p className="text-sm text-slate-500">
          ภาพรวมยอดขายและสถิติการจองตั๋ว
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-600">ยอดรวม</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="ยอดยืนยันทั้งหมด"
            value={formatBaht(confirmedAgg._sum.totalAmount ?? 0)}
            sub={`${confirmedAgg._count} รายการ · ${confirmedAgg._sum.quantity ?? 0} ใบ`}
            highlight
          />
          <Stat
            label="ยอด 30 วันล่าสุด"
            value={formatBaht(confirmedLast30._sum.totalAmount ?? 0)}
            sub={`${confirmedLast30._count} รายการ · ${confirmedLast30._sum.quantity ?? 0} ใบ`}
          />
          <Stat
            label="ยอดที่รอชำระ"
            value={formatBaht(pendingAgg._sum.totalAmount ?? 0)}
            sub={`${pendingAgg._count} รายการ · ${pendingAgg._sum.quantity ?? 0} ใบ`}
          />
          <Stat
            label="คืนเงินแล้ว"
            value={formatBaht(refundedAgg._sum.totalAmount ?? 0)}
            sub={`${refundedAgg._count} รายการ · ยกเลิก ${cancelledCount}`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-600">
          แมตช์ขายดี (Top 5)
        </h2>
        <div className="overflow-hidden rounded-lg border bg-white">
          {topMatchesRaw.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              ยังไม่มีการจอง
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-green-50 text-left text-xs uppercase text-green-900">
                <tr>
                  <th className="px-4 py-2">แมตช์</th>
                  <th className="px-4 py-2">วันแข่ง</th>
                  <th className="px-4 py-2 text-right">รายการ</th>
                  <th className="px-4 py-2 text-right">ใบที่จอง</th>
                  <th className="px-4 py-2 text-right">ยอดรวม</th>
                  <th className="px-4 py-2 text-right">% ที่นั่ง</th>
                </tr>
              </thead>
              <tbody>
                {topMatchesRaw.map((row) => {
                  const m = matchById.get(row.matchId);
                  const sold = row._sum.quantity ?? 0;
                  const pct = m?.totalSeats
                    ? Math.round((sold / m.totalSeats) * 100)
                    : 0;
                  return (
                    <tr key={row.matchId} className="border-t">
                      <td className="px-4 py-2 font-medium text-green-900">
                        {m ? `${m.homeTeam} vs ${m.awayTeam}` : row.matchId}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {m?.kickoffAt ? formatDateTime(m.kickoffAt) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{row._count}</td>
                      <td className="px-4 py-2 text-right">{sold}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatBaht(row._sum.totalAmount ?? 0)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-600">
          สถานะการจอง
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"] as const).map(
            (s) => {
              const row = statusBreakdown.find((b) => b.status === s);
              return (
                <Stat
                  key={s}
                  label={STATUS_LABEL[s]}
                  value={(row?._count ?? 0).toString()}
                />
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอชำระ",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิก",
  REFUNDED: "คืนเงินแล้ว",
};

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-yellow-400 bg-yellow-50" : "border-green-100 bg-white"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-green-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
