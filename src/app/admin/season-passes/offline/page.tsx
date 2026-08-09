import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { SEASON_LABEL } from "@/lib/season-pass-tiers";
import OfflineVvipForm from "./OfflineVvipForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ลงทะเบียน VVIP ออฟไลน์ — Admin" };

export default async function OfflineSeasonPassPage() {
  await verifyPermission("SEASON_PASSES");

  const [availableBarcodes, availableBarcodeCount, recentOrders] = await Promise.all([
    prisma.seasonPassBarcode.findMany({
      where: {
        tierId: "vvip-elite",
        seasonLabel: SEASON_LABEL,
        isGenerated: true,
        orderId: null,
      },
      orderBy: { barcode: "asc" },
      take: 500,
      select: { barcode: true },
    }),
    prisma.seasonPassBarcode.count({
      where: {
        tierId: "vvip-elite",
        seasonLabel: SEASON_LABEL,
        isGenerated: true,
        orderId: null,
      },
    }),
    prisma.seasonPassOrder.findMany({
      where: { tierId: "vvip-elite", salesChannel: "OFFLINE" },
      orderBy: { soldAt: "desc" },
      take: 100,
      select: {
        id: true,
        passCode: true,
        customerName: true,
        customerPhone: true,
        seatZone: true,
        seatNumber: true,
        shirtSize: true,
        paymentMethod: true,
        offlineReceiptNo: true,
        soldAt: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link href="/admin/season-passes/check" className="text-base font-medium text-green-800 hover:underline">
          ← กลับไปหน้าตรวจบัตรรายปี
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-green-900 md:text-4xl">ลงทะเบียนขาย VVIP 4,000 บาทแบบออฟไลน์</h1>
        <p className="mt-1 text-base text-slate-600 md:text-lg">
          ผูกบาร์โค้ดกับเจ้าของบัตรและที่นั่งก่อนนำไปใช้งานที่ประตูสนาม · เหลือ {availableBarcodeCount.toLocaleString("th-TH")} บาร์โค้ด
        </p>
      </header>

      <OfflineVvipForm barcodes={availableBarcodes.map((item) => item.barcode)} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-green-900">รายการที่ลงทะเบียนล่าสุด</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-base">
            <thead className="border-b bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">เวลาลงทะเบียน</th>
                <th className="px-3 py-2">บาร์โค้ด</th>
                <th className="px-3 py-2">เจ้าของบัตร</th>
                <th className="px-3 py-2">เบอร์ท้าย</th>
                <th className="px-3 py-2">ที่นั่ง</th>
                <th className="px-3 py-2">ไซส์</th>
                <th className="px-3 py-2">ชำระเงิน</th>
                <th className="px-3 py-2">เลขอ้างอิง</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{order.soldAt ? formatDateTime(order.soldAt) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-sm">{order.passCode}</td>
                  <td className="px-3 py-2 font-medium">{order.customerName}</td>
                  <td className="px-3 py-2 font-mono">•••• {order.customerPhone.replace(/\D/g, "").slice(-4)}</td>
                  <td className="px-3 py-2">{order.seatZone} · {order.seatNumber}</td>
                  <td className="px-3 py-2">{order.shirtSize ?? "—"}</td>
                  <td className="px-3 py-2">{order.paymentMethod === "OFFLINE_CASH" ? "เงินสด" : "โอนเงิน"}</td>
                  <td className="px-3 py-2">{order.offlineReceiptNo ?? "—"}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">ยังไม่มีรายการขาย VVIP แบบออฟไลน์</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
