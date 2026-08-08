import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import {
  SEASON_LABEL,
  SEASON_TIERS,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import { createXlsxWorkbook, type XlsxCell } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

type TierFilter = "all" | "none" | SeasonTierId;

export async function GET(request: Request) {
  await verifyPermission("MEMBER_DATA");

  const searchParams = new URL(request.url).searchParams;
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const rawTier = searchParams.get("tier") ?? "all";
  const selectedTier: TierFilter = [
    "all",
    "none",
    ...SEASON_TIERS.map((tier) => tier.id),
  ].includes(rawTier)
    ? (rawTier as TierFilter)
    : "all";

  const seasonOrders = await prisma.seasonPassOrder.findMany({
    where: {
      seasonLabel: SEASON_LABEL,
      customerId: { not: null },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      passCode: true,
      tierId: true,
      seatZone: true,
      status: true,
      customerId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const activeMemberIds = new Set(
    seasonOrders.flatMap((order) => order.customerId ? [order.customerId] : []),
  );
  const ordersByMember = new Map<string, typeof seasonOrders>();
  for (const order of seasonOrders) {
    if (!order.customerId) continue;
    const orders = ordersByMember.get(order.customerId) ?? [];
    orders.push(order);
    ordersByMember.set(order.customerId, orders);
  }

  const where: Prisma.CustomerWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  if (selectedTier === "none") {
    if (activeMemberIds.size > 0) where.id = { notIn: [...activeMemberIds] };
  } else if (selectedTier !== "all") {
    where.id = {
      in: seasonOrders.flatMap((order) =>
        order.tierId === selectedTier && order.customerId ? [order.customerId] : [],
      ),
    };
  }

  const members = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      district: true,
      province: true,
      postalCode: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      lastLoginAt: true,
      accounts: { select: { provider: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const tierById = new Map(SEASON_TIERS.map((tier) => [tier.id, tier]));
  const rows: XlsxCell[][] = members.map((member, index) => {
    const orders = ordersByMember.get(member.id) ?? [];
    const packages = orders.map((order) => {
      const tier = tierById.get(order.tierId as SeasonTierId);
      const status = order.status === "CONFIRMED" ? "ชำระแล้ว" : "รอชำระ";
      return `${tier?.badge ?? order.tierId} · โซน ${order.seatZone} · ${order.passCode} · ${status}`;
    });
    return [
      index + 1,
      member.name,
      member.email,
      member.phone ?? "",
      member.address ?? "",
      member.district ?? "",
      member.province ?? "",
      member.postalCode ?? "",
      packages.join("\n"),
      member.accounts.length
        ? member.accounts.map((account) => account.provider).join(", ")
        : "อีเมล / รหัสผ่าน",
      member.emailVerifiedAt ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน",
      member.phoneVerifiedAt ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน",
      member.createdAt,
      member.lastLoginAt,
    ];
  });

  const workbook = createXlsxWorkbook({
    sheetName: "ข้อมูลสมาชิก",
    title: "ข้อมูลสมาชิก Pattani FC",
    subtitle: `ฤดูกาล ${SEASON_LABEL} · ${members.length.toLocaleString("th-TH")} คน · ดาวน์โหลดเมื่อ ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date())}`,
    headers: [
      "ลำดับ",
      "ชื่อ-นามสกุล",
      "อีเมล",
      "เบอร์โทร",
      "ที่อยู่",
      "อำเภอ/เขต",
      "จังหวัด",
      "รหัสไปรษณีย์",
      "แพ็กเกจบัตรรายปี",
      "ช่องทางสมัคร",
      "สถานะยืนยันอีเมล",
      "สถานะยืนยันเบอร์โทร",
      "วันที่สมัคร",
      "เข้าใช้ล่าสุด",
    ],
    rows,
    columnWidths: [8, 24, 30, 16, 38, 20, 20, 16, 48, 20, 18, 18, 22, 22],
    dateColumns: [13, 14],
    textColumns: [3, 4, 8],
    dateTimeOffsetMinutes: 7 * 60,
  });

  const filename = `pattani-fc-members-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(Uint8Array.from(workbook).buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
