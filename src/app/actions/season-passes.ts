"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAllProvinces } from "geothai";
import type { SeasonPassOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readCustomerSession } from "@/lib/customer-session";
import { verifyPermission } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import {
  SEASON_LABEL,
  SEASON_MATCHES,
  SEASON_PASS_SEAT_ZONES,
  SEASON_PASS_SHIPPING_FEE_BAHT,
  SEASON_TIERS,
  getSeasonPublicSaleLimit,
} from "@/lib/season-pass-tiers";
import {
  calculateSeasonPassZoneRanges,
  formatSeasonPassSequence,
} from "@/lib/season-pass-zone-ranges";

function revalidateSeatAvailability() {
  revalidatePath("/season-pass");
  revalidatePath("/season-pass/apply");
  revalidatePath("/admin/matches/season-seats");
  revalidateTag("bookings", { expire: 0 });
}

// ─── Customer-facing: สร้างออเดอร์บัตรรายปี ─────────────────

const createSchema = z
  .object({
    tierId: z.enum(["vvip-elite", "vip-advanced", "premium", "gold"] as const),
    seatZone: z.enum(SEASON_PASS_SEAT_ZONES),
    quantity: z.number().int().positive(),
    name: z.string().trim().min(2, "กรุณากรอกชื่อ").max(100),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{9,15}$/, "เบอร์โทรไม่ถูกต้อง"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("รูปแบบอีเมลไม่ถูกต้อง")
      .max(200)
      .optional()
      .or(z.literal("")),
    paymentMethod: z.enum(["card", "promptpay", "banking"] as const),
    deliveryMethod: z.enum(["SHIPPING", "PICKUP"] as const),
    // shipping — required only if deliveryMethod=SHIPPING (refined below)
    shipAddress: z.string().trim().max(300).optional().or(z.literal("")),
    shipCity: z.string().trim().max(100).optional().or(z.literal("")),
    shipProvince: z.string().trim().max(100).optional().or(z.literal("")),
    shipPostalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นเลข 5 หลัก")
      .optional()
      .or(z.literal("")),
    shirtSize: z.enum(["S", "M", "L", "XL", "2XL", "3XL"] as const).optional().or(z.literal("")),
    shipNote: z.string().trim().max(300).optional().or(z.literal("")),
    // pickup — required only if deliveryMethod=PICKUP
    pickupLocation: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    const tier = SEASON_TIERS.find((item) => item.id === d.tierId);
    if (tier && !tier.allowedSeatZones.includes(d.seatZone)) {
      ctx.addIssue({
        code: "custom",
        path: ["seatZone"],
        message: "โซนที่นั่งไม่ตรงกับแพ็กเกจที่เลือก",
      });
    }

    if (!d.shirtSize) {
      ctx.addIssue({ code: "custom", path: ["shirtSize"], message: "กรุณาเลือกไซส์เสื้อ" });
    }

    if (d.deliveryMethod === "SHIPPING") {
      if (!d.shipAddress)
        ctx.addIssue({
          code: "custom",
          path: ["shipAddress"],
          message: "กรุณากรอกที่อยู่",
        });
      if (!d.shipCity)
        ctx.addIssue({
          code: "custom",
          path: ["shipCity"],
          message: "กรุณากรอกอำเภอ/เขต",
        });
      if (!d.shipProvince)
        ctx.addIssue({
          code: "custom",
          path: ["shipProvince"],
          message: "กรุณากรอกจังหวัด",
        });
      if (!d.shipPostalCode)
        ctx.addIssue({
          code: "custom",
          path: ["shipPostalCode"],
          message: "กรุณากรอกรหัสไปรษณีย์",
        });
      if (!d.shirtSize)
        ctx.addIssue({
          code: "custom",
          path: ["shirtSize"],
          message: "กรุณาเลือกไซส์เสื้อ",
        });
    } else if (d.deliveryMethod === "PICKUP") {
      if (!d.pickupLocation)
        ctx.addIssue({
          code: "custom",
          path: ["pickupLocation"],
          message: "กรุณาเลือกจุดรับบัตร",
        });
    }
  });

export type CreateSeasonPassResult =
  | { ok: true; checkoutCode: string; passCodes: string[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createSeasonPassOrder(
  input: z.input<typeof createSchema>,
): Promise<CreateSeasonPassResult> {
  if (input.tierId === "vvip-elite") {
    return { ok: false, error: "แพ็กเกจ VVIP 4,000 บาทสำหรับใช้งานภายในเท่านั้น ไม่เปิดจำหน่าย" };
  }
  // กัน abuse — สมัคร spam ไม่เกิน 5 ครั้ง / 10 นาที / IP
  const rl = await rateLimit("season_pass_create", {
    max: 5,
    windowMs: 10 * 60_000,
  });
  if (!rl.ok) {
    return {
      ok: false,
      error: `ทำรายการบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }
  const settings = await getTicketPurchaseSettings();
  if (parsed.data.quantity > settings.seasonPassMaxQuantity) {
    return {
      ok: false,
      error: `ซื้อบัตรรายปีได้สูงสุด ${settings.seasonPassMaxQuantity} ใบต่อหนึ่งคำสั่งซื้อ`,
      fieldErrors: { quantity: `สูงสุด ${settings.seasonPassMaxQuantity} ใบ` },
    };
  }

  if (parsed.data.deliveryMethod === "SHIPPING") {
    const province = getAllProvinces().find(
      (item) => item.name_th === parsed.data.shipProvince,
    );
    const district = province?.districts.find(
      (item) => item.name_th === parsed.data.shipCity,
    );
    const postalCodes = new Set(
      district?.subdistricts.map((item) => String(item.postal_code)) ?? [],
    );
    if (!province || !district || !postalCodes.has(parsed.data.shipPostalCode ?? "")) {
      return { ok: false, error: "กรุณาเลือกจังหวัด อำเภอ และรหัสไปรษณีย์จากรายการ" };
    }
  }

  const tier = SEASON_TIERS.find((t) => t.id === parsed.data.tierId);
  if (!tier) return { ok: false, error: "ไม่พบระดับบัตรที่เลือก" };
  const barcodePrefix = `PFC26-${tier.priceBaht}-`;

  const session = await readCustomerSession();
  const email = parsed.data.email || session?.email || null;
  const shippingFeeBaht =
    parsed.data.deliveryMethod === "SHIPPING"
      ? SEASON_PASS_SHIPPING_FEE_BAHT
      : 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize orders in the same annual package/zone so concurrent payments cannot oversell.
      const quotaLockKey = `${SEASON_LABEL}:${parsed.data.tierId}:${parsed.data.seatZone}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${quotaLockKey}))::text AS lock_result`;

      const configuredQuotas = await tx.seasonPassZoneQuota.findMany({
        where: {
          seasonLabel: SEASON_LABEL,
          tierId: parsed.data.tierId,
          seatZone: { in: [...tier.allowedSeatZones] },
        },
      });
      const hasCompleteZoneAllocation = configuredQuotas.length === tier.allowedSeatZones.length;
      const zoneRanges = hasCompleteZoneAllocation
        ? calculateSeasonPassZoneRanges(tier.allowedSeatZones, configuredQuotas)
        : [];
      const selectedRange = zoneRanges.find(
        (range) => range.seatZone === parsed.data.seatZone,
      );
      const legacyPublicSaleLimit = hasCompleteZoneAllocation
        ? null
        : getSeasonPublicSaleLimit(tier);
      const publicBarcodeLowerBound = selectedRange
        ? `${barcodePrefix}${formatSeasonPassSequence(selectedRange.publicStartSequence)}`
        : null;
      const publicBarcodeUpperBound = selectedRange
        ? `${barcodePrefix}${formatSeasonPassSequence(selectedRange.publicEndSequence)}`
        : legacyPublicSaleLimit == null
          ? null
          : `${barcodePrefix}${formatSeasonPassSequence(legacyPublicSaleLimit)}`;
      // Enforce per-zone quota after the package has a complete allocation.
      // Packages not configured yet keep the existing package-wide barcode limit.
      if (hasCompleteZoneAllocation) {
        const publicZoneLimit = selectedRange?.publicSeatCount ?? 0;
        const zoneSold = await tx.seasonPassOrder.count({
          where: {
            seasonLabel: SEASON_LABEL,
            tierId: parsed.data.tierId,
            seatZone: parsed.data.seatZone,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        });
        if (zoneSold + parsed.data.quantity > publicZoneLimit) {
          throw new Error("ZONE_SOLD_OUT");
        }
      }

      const barcodes = await tx.seasonPassBarcode.findMany({
        where: {
          tierId: parsed.data.tierId,
          seasonLabel: SEASON_LABEL,
          orderId: null,
          isGenerated: true,
          ...(publicBarcodeUpperBound
            ? {
                barcode: {
                  startsWith: barcodePrefix,
                  ...(publicBarcodeLowerBound ? { gte: publicBarcodeLowerBound } : {}),
                  lte: publicBarcodeUpperBound,
                },
              }
            : {}),
        },
        orderBy: { barcode: "asc" },
        take: parsed.data.quantity,
        select: { id: true, barcode: true },
      });
      if (barcodes.length !== parsed.data.quantity) throw new Error("SOLD_OUT");

      const purchaseCode = `SPP-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      const purchase = await tx.seasonPassPurchase.create({
        data: {
          purchaseCode,
          customerId: session?.customerId ?? null,
          customerEmail: email,
          quantity: parsed.data.quantity,
          subtotalBaht: tier.priceBaht * parsed.data.quantity,
          shippingFeeBaht,
          totalBaht: tier.priceBaht * parsed.data.quantity + shippingFeeBaht,
          paymentMethod: parsed.data.paymentMethod,
          status: "PENDING",
        },
      });

      const passCodes: string[] = [];
      for (const [index, barcode] of barcodes.entries()) {
        const created = await tx.seasonPassOrder.create({
          data: {
            passCode: barcode.barcode,
            tierId: parsed.data.tierId,
            seatZone: parsed.data.seatZone,
            seasonLabel: SEASON_LABEL,
            priceBaht: tier.priceBaht,
            shippingFeeBaht: index === 0 ? shippingFeeBaht : 0,
            customerId: session?.customerId ?? null,
            customerName: parsed.data.name,
            customerPhone: parsed.data.phone,
            customerEmail: email,
            deliveryMethod: parsed.data.deliveryMethod,
            shipAddress: parsed.data.shipAddress || null,
            shipCity: parsed.data.shipCity || null,
            shipProvince: parsed.data.shipProvince || null,
            shipPostalCode: parsed.data.shipPostalCode || null,
            shirtSize: parsed.data.shirtSize || null,
            shipNote: parsed.data.shipNote || null,
            pickupLocation: parsed.data.pickupLocation || null,
            paymentMethod: parsed.data.paymentMethod,
            status: "PENDING",
            purchaseId: purchase.id,
          },
        });
        const claimed = await tx.seasonPassBarcode.updateMany({
          where: { id: barcode.id, orderId: null, isGenerated: true },
          data: { orderId: created.id, assignedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error("SOLD_OUT");
        passCodes.push(created.passCode);
      }
      return { purchaseCode, passCodes };
    });
    revalidatePath("/admin/season-passes");
    revalidateSeatAvailability();
    return { ok: true, checkoutCode: result.purchaseCode, passCodes: result.passCodes };
  } catch (error) {
    if (error instanceof Error && error.message === "ZONE_SOLD_OUT") {
      return { ok: false, error: "บัตรรายปีโซนที่เลือกจำหน่ายหมดแล้ว กรุณาเลือกโซนอื่น" };
    }
    if (error instanceof Error && error.message === "SOLD_OUT") {
      return { ok: false, error: "บัตรประเภทนี้จำหน่ายหมดแล้ว" };
    }
    return { ok: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }
}

// สร้าง passCode รูปแบบ SP-<TIER>-<8 chars> (ตัวอักษรอ่านง่าย)
// ─── Admin: เปลี่ยนสถานะออเดอร์ ─────────────────────────────
const statusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "REFUNDED",
] as const);

export async function updateSeasonPassStatus(
  orderId: string,
  status: SeasonPassOrderStatus,
): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("SEASON_PASSES");
  if (!statusEnum.safeParse(status).success) {
    return { error: "สถานะไม่ถูกต้อง" };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.seasonPassOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("NOT_FOUND");

      const groupedOrders = order.purchaseId
        ? await tx.seasonPassOrder.findMany({
            where: { purchaseId: order.purchaseId },
            select: { status: true },
          })
        : [{ status: order.status }];
      const targetIsActive = ["PENDING", "CONFIRMED"].includes(status);
      const newlyActiveCount = targetIsActive
        ? groupedOrders.filter(
            (item) => !["PENDING", "CONFIRMED"].includes(item.status),
          ).length
        : 0;
      if (newlyActiveCount > 0) {
        const quotaLockKey = `${order.seasonLabel}:${order.tierId}:${order.seatZone}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${quotaLockKey}))::text AS lock_result`;
        const tier = SEASON_TIERS.find((item) => item.id === order.tierId);
        if (tier) {
          const quotas = await tx.seasonPassZoneQuota.findMany({
            where: {
              seasonLabel: order.seasonLabel,
              tierId: order.tierId,
              seatZone: { in: [...tier.allowedSeatZones] },
            },
          });
          if (quotas.length === tier.allowedSeatZones.length) {
            const quota = quotas.find((item) => item.seatZone === order.seatZone);
            const limit = quota ? Math.max(0, quota.totalSeats - quota.sponsorReserved) : 0;
            const active = await tx.seasonPassOrder.count({
              where: {
                seasonLabel: order.seasonLabel,
                tierId: order.tierId,
                seatZone: order.seatZone,
                status: { in: ["PENDING", "CONFIRMED"] },
              },
            });
            if (active + newlyActiveCount > limit) throw new Error("ZONE_SOLD_OUT");
          }
        }
      }

      if (order.purchaseId) {
        await tx.seasonPassOrder.updateMany({
          where: { purchaseId: order.purchaseId },
          data: { status },
        });
        await tx.seasonPassPurchase.update({
          where: { id: order.purchaseId },
          data: { status },
        });
      } else {
        await tx.seasonPassOrder.update({ where: { id: orderId }, data: { status } });
      }
    });
    revalidatePath("/admin/season-passes");
    revalidateSeatAvailability();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "ZONE_SOLD_OUT") {
      return { error: "โซนนี้เต็มตามโควตาบัตรรายปีแล้ว ไม่สามารถเปิดรายการนี้กลับมาได้" };
    }
    return { error: "อัปเดตไม่สำเร็จ" };
  }
}

export async function deleteSeasonPassOrder(
  orderId: string,
): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("SEASON_PASSES");
  if (typeof orderId !== "string" || !/^[a-z0-9]+$/i.test(orderId)) {
    return { error: "รหัสไม่ถูกต้อง" };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.seasonPassOrder.findUnique({
        where: { id: orderId },
        select: { purchaseId: true },
      });
      if (!order) throw new Error("NOT_FOUND");
      await tx.seasonPassOrder.delete({ where: { id: orderId } });
      if (!order.purchaseId) return;

      const remaining = await tx.seasonPassOrder.aggregate({
        where: { purchaseId: order.purchaseId },
        _count: { _all: true },
        _sum: { priceBaht: true, shippingFeeBaht: true },
      });
      if (remaining._count._all === 0) {
        await tx.seasonPassPurchase.delete({ where: { id: order.purchaseId } });
        return;
      }
      await tx.beamPayment.deleteMany({ where: { seasonPassPurchaseId: order.purchaseId } });
      await tx.xenditPayment.deleteMany({ where: { seasonPassPurchaseId: order.purchaseId } });
      const subtotalBaht = remaining._sum.priceBaht ?? 0;
      const remainingShippingFee = remaining._sum.shippingFeeBaht ?? 0;
      await tx.seasonPassPurchase.update({
        where: { id: order.purchaseId },
        data: {
          quantity: remaining._count._all,
          subtotalBaht,
          shippingFeeBaht: remainingShippingFee,
          totalBaht: subtotalBaht + remainingShippingFee,
        },
      });
    });
    revalidatePath("/admin/season-passes");
    revalidateSeatAvailability();
    return { ok: true };
  } catch {
    return { error: "ลบไม่สำเร็จ" };
  }
}

// Admin: ล้างการจองบัตรรายปีทั้งหมดสำหรับการทดสอบ โดยคืนบาร์โค้ดให้จองใหม่ได้
export async function deleteAllSeasonPassOrders(): Promise<
  { ok: true; deleted: number } | { error: string }
> {
  await verifyPermission("SEASON_PASSES");

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const orders = await tx.seasonPassOrder.findMany({
        select: { id: true },
      });
      const orderIds = orders.map((order) => order.id);
      if (orderIds.length === 0) {
        await tx.seasonPassPurchase.deleteMany();
        return 0;
      }

      const barcodes = await tx.seasonPassBarcode.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
      });
      const barcodeIds = barcodes.map((barcode) => barcode.id);

      if (barcodeIds.length > 0) {
        await tx.seasonPassScan.deleteMany({
          where: { barcodeId: { in: barcodeIds } },
        });
        await tx.seasonPassBarcode.updateMany({
          where: { id: { in: barcodeIds } },
          data: {
            orderId: null,
            assignedAt: null,
            usesRemaining: SEASON_MATCHES,
          },
        });
      }

      const result = await tx.seasonPassOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
      await tx.seasonPassPurchase.deleteMany();
      return result.count;
    });

    revalidatePath("/admin/season-passes");
    revalidatePath("/admin/season-passes/check");
    revalidateSeatAvailability();
    return { ok: true, deleted };
  } catch {
    return { error: "ลบการจองทั้งหมดไม่สำเร็จ" };
  }
}
