import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import {
  SEASON_LABEL,
  SEASON_MATCHES,
  SEASON_TIERS,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import SeasonPassStatusSelect from "./SeasonPassStatusSelect";
import DeleteSeasonPassButton from "./DeleteSeasonPassButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "บัตรรายปี — Admin" };

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  REFUNDED: "bg-blue-100 text-blue-800",
};

export default async function AdminSeasonPassesPage(props: {
  searchParams: Promise<{ tier?: string }>;
}) {
  await verifyPermission("SEASON_PASSES");
  const { tier: rawTier } = await props.searchParams;
  const selectedTier = SEASON_TIERS.some((tier) => tier.id === rawTier)
    ? (rawTier as SeasonTierId)
    : null;

  const orders = await prisma.seasonPassOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const tierById = new Map(SEASON_TIERS.map((t) => [t.id, t]));
  const ordersByTier = new Map<SeasonTierId, typeof orders>();
  for (const tier of SEASON_TIERS) ordersByTier.set(tier.id, []);
  for (const order of orders) {
    const tierOrders = ordersByTier.get(order.tierId as SeasonTierId);
    if (tierOrders) tierOrders.push(order);
  }
  const displayedOrders = selectedTier ? ordersByTier.get(selectedTier) ?? [] : orders;

  const summary = {
    total: orders.length,
    confirmed: orders.filter((o) => o.status === "CONFIRMED").length,
    pending: orders.filter((o) => o.status === "PENDING").length,
    revenue: orders
      .filter((o) => o.status === "CONFIRMED")
      .reduce((sum, o) => sum + o.priceBaht + o.shippingFeeBaht, 0),
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-900">
            บัตรรายปี · Season Pass {SEASON_LABEL}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            บัตรสมาชิกครอบคลุม {SEASON_MATCHES} แมตช์เหย้าต่อฤดูกาล
          </p>
        </div>
      </div>

      {/* สรุปตัวเลข */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="บัตรทั้งหมด"
          value={summary.total.toLocaleString("th-TH")}
        />
        <StatCard
          label="ยืนยันแล้ว"
          value={summary.confirmed.toLocaleString("th-TH")}
          accent="emerald"
        />
        <StatCard
          label="รอชำระ"
          value={summary.pending.toLocaleString("th-TH")}
          accent="amber"
        />
        <StatCard
          label="รายได้ (ยืนยันแล้ว)"
          value={`฿${summary.revenue.toLocaleString("th-TH")}`}
          accent="green"
        />
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-green-900">แยกข้อมูลการซื้อตามแพ็กเกจ</h2>
          {selectedTier && (
            <Link href="/admin/season-passes" className="text-sm font-medium text-green-800 hover:underline">
              แสดงทั้งหมด
            </Link>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEASON_TIERS.filter((tier) => tier.id !== "vvip-elite").map((tier) => {
            const tierOrders = ordersByTier.get(tier.id) ?? [];
            const confirmed = tierOrders.filter((order) => order.status === "CONFIRMED");
            const revenue = confirmed.reduce((sum, order) => sum + order.priceBaht + order.shippingFeeBaht, 0);
            return (
              <Link
                key={tier.id}
                href={`/admin/season-passes?tier=${tier.id}`}
                className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedTier === tier.id ? "border-yellow-400 bg-yellow-50" : "border-green-100 bg-white"}`}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-yellow-700">แพ็กเกจ ฿{tier.priceBaht.toLocaleString("th-TH")}</p>
                <p className="mt-1 text-sm font-bold text-green-900">{tier.badge}</p>
                <p className="mt-3 text-2xl font-black text-green-900">{tierOrders.length.toLocaleString("th-TH")} <span className="text-sm font-medium">รายการ</span></p>
                <p className="mt-1 text-xs text-slate-600">ยืนยันแล้ว {confirmed.length} รายการ · ฿{revenue.toLocaleString("th-TH")}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ตารางบัตร */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">รหัสบัตร</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">ลูกค้า</th>
              <th className="px-3 py-2 text-left">การจัดส่ง</th>
              <th className="px-3 py-2 text-right">ยอดรวม</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="px-3 py-2 text-left">วันที่</th>
              <th className="px-3 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {displayedOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  ยังไม่มีคนซื้อบัตรรายปี — เมื่อลูกค้าสมัครที่{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                    /season-pass/apply
                  </code>{" "}
                  จะปรากฏที่นี่
                </td>
              </tr>
            ) : (
              displayedOrders.map((o) => {
                const tier = tierById.get(o.tierId as SeasonTierId);
                const isMember = !!o.customerId;
                const total = o.priceBaht + o.shippingFeeBaht;
                return (
                  <tr key={o.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 font-mono text-xs">
                      {o.passCode}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-yellow-100 px-2 py-0.5 text-[11px] font-bold text-yellow-900">
                        {tier?.badge ?? o.tierId}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-xs text-slate-500">
                        {o.customerEmail ?? (
                          <span className="italic">ไม่มีอีเมล</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {o.customerPhone}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${
                            isMember
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isMember ? "สมาชิก" : "ลูกค้าทั่วไป"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {o.deliveryMethod === "SHIPPING" ? (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                            📦 ส่งพัสดุ (+฿{o.shippingFeeBaht})
                          </div>
                          <div className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700">
                            {o.shipAddress}
                            {o.shipCity && ` · ${o.shipCity}`}
                            {o.shipProvince && ` · ${o.shipProvince}`}
                            {o.shipPostalCode && ` ${o.shipPostalCode}`}
                          </div>
                          {o.shipNote && (
                            <div className="mt-0.5 text-[11px] italic text-slate-500">
                              หมายเหตุ: {o.shipNote}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            🏟️ รับด้วยตัวเอง
                          </div>
                          <div className="mt-0.5 text-xs text-slate-700">
                            {o.pickupLocation ?? "—"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-semibold">
                        ฿{total.toLocaleString("th-TH")}
                      </div>
                      {o.shippingFeeBaht > 0 && (
                        <div className="text-[10px] text-slate-500">
                          บัตร ฿{o.priceBaht.toLocaleString("th-TH")} + ส่ง ฿
                          {o.shippingFeeBaht}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            statusColor[o.status]
                          }`}
                        >
                          {o.status}
                        </span>
                        <SeasonPassStatusSelect
                          orderId={o.id}
                          current={o.status}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DeleteSeasonPassButton
                        orderId={o.id}
                        passCode={o.passCode}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* สรุปประเภทบัตรที่เปิดขาย */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-green-900">
          ประเภทบัตรที่เปิดขาย
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEASON_TIERS.filter((t) => t.id !== "vvip-elite").map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-600">
                {t.badge}
              </p>
              <p className="mt-1 text-sm font-semibold text-green-900">
                {t.name}
              </p>
              <p className="mt-2 text-2xl font-black text-green-900">
                ฿{t.priceBaht.toLocaleString("th-TH")}
              </p>
              <p className="text-xs text-slate-500">
                / ฤดูกาล · {SEASON_MATCHES} แมตช์
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber" | "green";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "green"
          ? "text-green-800"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-black ${accentClass}`}>{value}</p>
    </div>
  );
}
