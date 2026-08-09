import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import {
  SEASON_LABEL,
  SEASON_MATCHES,
  SEASON_TIERS,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import { formatDateTime } from "@/lib/format";
import { getStadiumZone } from "@/lib/stadium-zones";
import Link from "next/link";
import SeasonPassStatusSelect from "./SeasonPassStatusSelect";
import DeleteSeasonPassButton from "./DeleteSeasonPassButton";
import DeleteAllSeasonPassOrdersButton from "./DeleteAllSeasonPassOrdersButton";

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
  const saleTiers = SEASON_TIERS.filter((tier) => tier.id !== "vvip-elite");
  const selectedTier = saleTiers.some((tier) => tier.id === rawTier)
    ? (rawTier as SeasonTierId)
    : saleTiers[0].id;

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
  const displayedOrders = ordersByTier.get(selectedTier) ?? [];

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
          <h1 className="text-3xl font-bold text-green-900 md:text-4xl">
            บัตรรายปี · Season Pass {SEASON_LABEL}
          </h1>
          <p className="mt-1 text-base text-slate-600 md:text-lg">
            บัตรสมาชิกครอบคลุม {SEASON_MATCHES} แมตช์เหย้าต่อฤดูกาล
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/season-passes/offline"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-base font-medium text-amber-900 hover:bg-amber-100 md:text-lg"
          >
            + ลงทะเบียน VVIP 4,000 ออฟไลน์
          </Link>
          <Link
            href="/admin/ticket-settings"
            className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-base font-medium text-violet-900 hover:bg-violet-100 md:text-lg"
          >
            ⚙️ ตั้งค่าจำนวนสูงสุดต่อรายการ
          </Link>
          <Link
            href="/admin/season-passes/check"
            className="rounded-md border border-green-200 bg-white px-3 py-2 text-base font-medium text-green-900 hover:bg-green-50 md:text-lg"
          >
            🎫 สแกนและประวัติการใช้งานบัตรรายปี
          </Link>
          <a
            href={`/admin/season-passes/export?tier=${selectedTier}`}
            className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-2 text-base font-medium text-white hover:bg-emerald-800 md:text-lg"
          >
            📥 ดาวน์โหลด Excel ({tierById.get(selectedTier)?.priceBaht.toLocaleString("th-TH")} บาท)
          </a>
          <DeleteAllSeasonPassOrdersButton count={orders.length} />
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
          <h2 className="text-2xl font-bold text-green-900 md:text-3xl">ข้อมูลการจองตามแพ็กเกจ</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="แพ็กเกจบัตรรายปี">
          {saleTiers.map((tier) => {
            const tierOrders = ordersByTier.get(tier.id) ?? [];
            const confirmed = tierOrders.filter((order) => order.status === "CONFIRMED");
            const revenue = confirmed.reduce((sum, order) => sum + order.priceBaht + order.shippingFeeBaht, 0);
            const orderCountByZone = new Map(
              tier.allowedSeatZones.map((seatZone) => [
                seatZone,
                tierOrders.filter((order) => order.seatZone === seatZone).length,
              ]),
            );
            return (
              <Link
                key={tier.id}
                href={`/admin/season-passes?tier=${tier.id}`}
                role="tab"
                aria-selected={selectedTier === tier.id}
                className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-700/30 ${selectedTier === tier.id ? "border-green-700 bg-green-50 ring-2 ring-green-700/20" : "border-green-100 bg-white"}`}
              >
                <p className="text-sm font-bold uppercase tracking-widest text-yellow-700 md:text-base">แพ็กเกจ ฿{tier.priceBaht.toLocaleString("th-TH")}</p>
                <p className="mt-1 text-base font-bold text-green-900 md:text-lg">{tier.badge}</p>
                <p className="mt-3 text-3xl font-black text-green-900 md:text-4xl">{tierOrders.length.toLocaleString("th-TH")} <span className="text-base font-medium md:text-lg">รายการ</span></p>
                <p className="mt-1 text-sm text-slate-600 md:text-base">ยืนยันแล้ว {confirmed.length} รายการ · ฿{revenue.toLocaleString("th-TH")}</p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`รายละเอียดโซนแพ็กเกจ ${tier.badge}`}>
                  {tier.allowedSeatZones.map((seatZone) => (
                    <span
                      key={seatZone}
                      className="rounded-full border border-green-200 bg-white px-2.5 py-1 text-sm font-semibold text-green-900"
                    >
                      {seatZone} · {(orderCountByZone.get(seatZone) ?? 0).toLocaleString("th-TH")}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ตารางบัตร */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm" role="tabpanel">
        <table className="w-full min-w-[1300px] text-base md:text-lg">
          <thead className="border-b bg-slate-50 text-sm uppercase md:text-base">
            <tr>
              <th className="px-3 py-2 text-left">รหัสบัตร</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">โซนที่เลือก</th>
              <th className="px-3 py-2 text-left">ไซส์เสื้อ</th>
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
                <td colSpan={10} className="p-8 text-center text-slate-500">
                  ยังไม่มีคนซื้อบัตรรายปี — เมื่อลูกค้าสมัครที่{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
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
                    <td className="px-3 py-2 font-mono text-sm md:text-base">
                      {o.passCode}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-yellow-100 px-2 py-0.5 text-sm font-bold text-yellow-900">
                        {tier?.badge ?? o.tierId}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex rounded-md border border-green-200 bg-green-50 px-2.5 py-1 font-bold text-green-900">
                        {o.seatZone}
                      </div>
                      {getSeasonPassZoneDetail(o.seatZone) && (
                        <div className="mt-1 text-sm text-slate-600 md:text-base">
                          {getSeasonPassZoneDetail(o.seatZone)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {o.shirtSize ? (
                        <span className="inline-flex min-w-10 justify-center rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 font-bold uppercase text-violet-900">
                          {o.shirtSize}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-sm text-slate-500 md:text-base">
                        {o.customerEmail ?? (
                          <span className="italic">ไม่มีอีเมล</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 md:text-base">
                        {o.customerPhone}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium ${
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
                          <div className="text-sm font-bold uppercase tracking-wider text-blue-700">
                            📦 ส่งพัสดุ (+฿{o.shippingFeeBaht})
                          </div>
                          <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700 md:text-base">
                            {o.shipAddress}
                            {o.shipCity && ` · ${o.shipCity}`}
                            {o.shipProvince && ` · ${o.shipProvince}`}
                            {o.shipPostalCode && ` ${o.shipPostalCode}`}
                          </div>
                          {o.shipNote && (
                            <div className="mt-0.5 text-sm italic text-slate-500">
                              หมายเหตุ: {o.shipNote}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-bold uppercase tracking-wider text-emerald-700">
                            🏟️ รับด้วยตัวเอง
                          </div>
                          <div className="mt-0.5 text-sm text-slate-700 md:text-base">
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
                        <div className="text-sm text-slate-500">
                          บัตร ฿{o.priceBaht.toLocaleString("th-TH")} + ส่ง ฿
                          {o.shippingFeeBaht}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`rounded px-2 py-0.5 text-sm ${
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
                    <td className="px-3 py-2 text-sm text-slate-500 md:text-base">
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

    </div>
  );
}

function getSeasonPassZoneDetail(seatZone: string) {
  const stadiumZoneCode = seatZone.split("-").pop();
  return getStadiumZone(stadiumZoneCode)?.label ?? null;
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
      <p className="text-sm font-medium uppercase tracking-wider text-slate-500 md:text-base">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-black md:text-4xl ${accentClass}`}>{value}</p>
    </div>
  );
}
