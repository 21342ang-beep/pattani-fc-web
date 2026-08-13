import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { SEASON_LABEL, SEASON_TIERS } from "@/lib/season-pass-tiers";
import { calculateSeasonPassZoneRanges, formatSeasonPassSequence } from "@/lib/season-pass-zone-ranges";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import StaffSeasonPassForm from "./StaffSeasonPassForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "จองบัตรรายปีโดยทีมงาน — Admin" };

export default async function StaffSeasonPassPage() {
  await verifyPermission("SEASON_PASSES");
  const [settings, quotas, soldGroups, availableBarcodes, vvipBarcodes, recentOrders, members] = await Promise.all([
    getTicketPurchaseSettings(),
    prisma.seasonPassZoneQuota.findMany({ where: { seasonLabel: SEASON_LABEL } }),
    prisma.seasonPassOrder.groupBy({
      by: ["tierId", "seatZone"],
      where: { seasonLabel: SEASON_LABEL, status: { in: ["PENDING", "CONFIRMED"] } },
      _count: { _all: true },
    }),
    prisma.seasonPassBarcode.findMany({
      where: { seasonLabel: SEASON_LABEL, isGenerated: true, orderId: null },
      select: { tierId: true, barcode: true },
    }),
    prisma.seasonPassBarcode.findMany({
      where: { tierId: "vvip-elite", seasonLabel: SEASON_LABEL, isGenerated: true, orderId: null },
      orderBy: { barcode: "asc" },
      take: 500,
      select: { barcode: true },
    }),
    prisma.seasonPassOrder.findMany({
      where: { seasonLabel: SEASON_LABEL, salesChannel: "OFFLINE" },
      orderBy: { soldAt: "desc" },
      take: 100,
      select: {
        id: true,
        passCode: true,
        tierId: true,
        customerName: true,
        customerPhone: true,
        customerId: true,
        seatZone: true,
        seatNumber: true,
        shirtSize: true,
        paymentMethod: true,
        soldAt: true,
        soldById: true,
      },
    }),
    prisma.customer.findMany({
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, phone: true, email: true },
    }),
  ]);

  const sellerIds = [...new Set(recentOrders.map((order) => order.soldById).filter((id): id is string => Boolean(id)))];
  const sellers = sellerIds.length
    ? await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller.name || seller.email]));

  const tierOptions = SEASON_TIERS.map((tier) => {
    const tierQuotas = quotas.filter((quota) => quota.tierId === tier.id);
    const hasCompleteAllocation = tier.inventory != null && tierQuotas.length === tier.allowedSeatZones.length;
    const ranges = hasCompleteAllocation
      ? calculateSeasonPassZoneRanges(tier.allowedSeatZones, tierQuotas)
      : [];
    const barcodePrefix = `PFC26-${tier.priceBaht}-`;
    const legacyUpperBound = tier.inventory
      ? `${barcodePrefix}${formatSeasonPassSequence(Math.max(0, tier.inventory.total - tier.inventory.sponsorReserved))}`
      : null;
    const availableBarcodeCount = availableBarcodes.filter((barcode) => {
      if (barcode.tierId !== tier.id) return false;
      if (tier.id === "vvip-elite") return true;
      if (ranges.length > 0) {
        return ranges.some((range) => {
          const lower = `${barcodePrefix}${formatSeasonPassSequence(range.publicStartSequence)}`;
          const upper = `${barcodePrefix}${formatSeasonPassSequence(range.publicEndSequence)}`;
          return barcode.barcode >= lower && barcode.barcode <= upper;
        });
      }
      return barcode.barcode.startsWith(barcodePrefix) && legacyUpperBound != null && barcode.barcode <= legacyUpperBound;
    }).length;
    return {
      id: tier.id,
      badge: tier.badge,
      priceBaht: tier.priceBaht,
      availableBarcodeCount,
      zones: tier.allowedSeatZones.map((seatZone) => {
        const sold = soldGroups.find((group) => group.tierId === tier.id && group.seatZone === seatZone)?._count._all ?? 0;
        const quota = tierQuotas.find((item) => item.seatZone === seatZone);
        const limit = hasCompleteAllocation && quota
          ? Math.max(0, quota.totalSeats - quota.sponsorReserved)
          : null;
        return { seatZone, remaining: limit == null ? null : Math.max(0, limit - sold) };
      }),
    };
  });

  const phaseLabel = {
    STAFF_ONLY: "รอบทีมงาน",
    PUBLIC_OPEN: "เปิดจองทั่วไปแล้ว",
    CLOSED: "ปิดการจองทั้งหมด",
  }[settings.seasonPassSalePhase];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link href="/admin/matches" className="text-base font-medium text-green-800 hover:underline">
          ← กลับหน้าจัดการแมตช์
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-green-900 md:text-4xl">จองบัตรรายปีโดยทีมงาน</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${settings.seasonPassSalePhase === "CLOSED" ? "bg-red-100 text-red-700" : settings.seasonPassSalePhase === "PUBLIC_OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
            {phaseLabel}
          </span>
        </div>
        <p className="mt-2 text-base text-slate-600 md:text-lg">
          ฤดูกาล {SEASON_LABEL} · บันทึกเป็นช่องทางทีมงานและระบุบัญชีผู้ทำรายการทุกครั้ง
        </p>
      </header>

      <StaffSeasonPassForm
        tiers={tierOptions}
        vvipBarcodes={vvipBarcodes.map((item) => item.barcode)}
        members={members}
        disabled={settings.seasonPassSalePhase === "CLOSED"}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-green-900">รายการที่ทีมงานจองล่าสุด</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1100px] text-base">
            <thead className="border-b bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">เวลา</th>
                <th className="px-3 py-2">บัตร</th>
                <th className="px-3 py-2">แพ็กเกจ</th>
                <th className="px-3 py-2">ลูกค้า</th>
                <th className="px-3 py-2">เบอร์ท้าย</th>
                <th className="px-3 py-2">ที่นั่ง</th>
                <th className="px-3 py-2">ไซส์เสื้อ</th>
                <th className="px-3 py-2">ชำระเงิน</th>
                <th className="px-3 py-2">จองโดย</th>
                <th className="px-3 py-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{order.soldAt ? formatDateTime(order.soldAt) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-sm">{order.passCode.startsWith("PENDING-") ? "รอระบบผูกบาร์โค้ด" : order.passCode}</td>
                  <td className="px-3 py-2">{SEASON_TIERS.find((tier) => tier.id === order.tierId)?.badge ?? order.tierId}</td>
                  <td className="px-3 py-2 font-medium">
                    <div>{order.customerName}</div>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${order.customerId ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                      {order.customerId ? "เชื่อมสมาชิกแล้ว" : "รายการเดิมยังไม่เชื่อมสมาชิก"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">•••• {order.customerPhone.replace(/\D/g, "").slice(-4)}</td>
                  <td className="px-3 py-2">{order.seatZone || "รอระบุโซน"}{order.seatNumber ? ` · ${order.seatNumber}` : ""}</td>
                  <td className="px-3 py-2 font-semibold">{order.shirtSize || "—"}</td>
                  <td className="px-3 py-2">{order.paymentMethod === "OFFLINE_CASH" ? "เงินสด" : "โอนเงิน"}</td>
                  <td className="px-3 py-2 font-medium text-green-800">{order.soldById ? sellerById.get(order.soldById) ?? "บัญชีเดิม" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/season-passes/${order.id}/edit?tier=${order.tierId}&from=staff`} className="font-semibold text-green-700 hover:text-green-900">
                      แก้ไข
                    </Link>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-slate-500">ยังไม่มีรายการจองโดยทีมงาน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
