import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import {
  SEASON_LABEL,
  SEASON_TIERS,
} from "@/lib/season-pass-tiers";
import { getStadiumZone } from "@/lib/stadium-zones";
import { createXlsxWorkbook, type XlsxCell } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await verifyPermission("SEASON_PASSES");

  const rawTier = new URL(request.url).searchParams.get("tier");
  const tier = SEASON_TIERS.find((item) => item.id === rawTier);
  if (!tier) return new Response("Invalid season-pass tier", { status: 400 });

  const orders = await prisma.seasonPassOrder.findMany({
    where: {
      tierId: tier.id,
      seasonLabel: SEASON_LABEL,
      status: { not: "CANCELLED" },
    },
    orderBy: [{ createdAt: "asc" }, { passCode: "asc" }],
  });

  const headers = [
    "ลำดับ",
    "รหัสบัตร",
    "ฤดูกาล",
    "แพ็กเกจ",
    "ราคาบัตร (บาท)",
    "โซนที่นั่ง",
    "รายละเอียดโซน",
    "ไซส์เสื้อ",
    "ชื่อลูกค้า",
    "อีเมล",
    "เบอร์โทร",
    "ประเภทลูกค้า",
    "วิธีรับบัตร",
    "ที่อยู่",
    "อำเภอ/เขต",
    "จังหวัด",
    "รหัสไปรษณีย์",
    "รายละเอียดเพิ่มเติม",
    "ค่าจัดส่ง (บาท)",
    "ยอดรวม (บาท)",
    "ช่องทางชำระเงิน",
    "สถานะ",
    "วันที่จอง",
  ];

  const rows: XlsxCell[][] = orders.map((order, index) => {
    const shipping = order.deliveryMethod === "SHIPPING";
    return [
      index + 1,
      order.passCode,
      order.seasonLabel,
      tier.badge,
      order.priceBaht,
      order.seatZone,
      getSeasonPassZoneDetail(order.seatZone),
      order.shirtSize ?? "",
      order.customerName,
      order.customerEmail ?? "",
      order.customerPhone,
      order.customerId ? "สมาชิก" : "ลูกค้าทั่วไป",
      shipping ? "จัดส่งพัสดุ" : "รับด้วยตัวเอง",
      shipping ? order.shipAddress ?? "" : "",
      shipping ? order.shipCity ?? "" : "",
      shipping ? order.shipProvince ?? "" : "",
      shipping ? order.shipPostalCode ?? "" : "",
      shipping ? order.shipNote ?? "" : order.pickupLocation ?? "",
      order.shippingFeeBaht,
      order.priceBaht + order.shippingFeeBaht,
      paymentMethodLabel(order.paymentMethod),
      statusLabel(order.status),
      order.createdAt,
    ];
  });

  const workbook = createXlsxWorkbook({
    sheetName: `แพ็กเกจ ${tier.priceBaht}`,
    title: `รายละเอียดการจองบัตรรายปี Pattani FC — ${tier.badge}`,
    subtitle: `ฤดูกาล ${SEASON_LABEL} · ${orders.length.toLocaleString("th-TH")} รายการ · ดาวน์โหลดเมื่อ ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date())}`,
    headers,
    rows,
    columnWidths: [8, 22, 12, 24, 16, 14, 34, 12, 24, 28, 16, 16, 18, 36, 20, 20, 16, 32, 16, 16, 18, 16, 22],
    currencyColumns: [5, 19, 20],
    dateColumns: [23],
    textColumns: [2, 3, 11, 17],
    dateTimeOffsetMinutes: 7 * 60,
  });

  const safeSeason = SEASON_LABEL.replace(/[^0-9A-Za-z-]+/g, "-");
  const filename = `pattani-fc-season-passes-${tier.id}-${safeSeason}.xlsx`;
  return new Response(Uint8Array.from(workbook).buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getSeasonPassZoneDetail(code: string) {
  const stadiumZoneCode = code.split("-").pop();
  return getStadiumZone(stadiumZoneCode)?.label ?? "";
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    card: "บัตรเครดิต/เดบิต",
    promptpay: "พร้อมเพย์",
    banking: "โมบายแบงก์กิ้ง",
    OFFLINE_CASH: "เงินสด (ทีมงาน)",
    OFFLINE_TRANSFER: "โอนเงิน (ทีมงาน)",
  };
  return labels[method] ?? method;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "รอชำระเงิน",
    CONFIRMED: "ยืนยันแล้ว",
    CANCELLED: "ยกเลิก",
    REFUNDED: "คืนเงินแล้ว",
  };
  return labels[status] ?? status;
}
