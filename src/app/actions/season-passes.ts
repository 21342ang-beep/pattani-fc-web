"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAllProvinces } from "geothai";
import { Prisma, type SeasonPassOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeBookingSearchPhone } from "@/lib/booking-search-otp";
import { readCustomerSession } from "@/lib/customer-session";
import { verifyPermission } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import {
  SEASON_LABEL,
  SEASON_MATCHES,
  SEASON_PASS_SEAT_ZONES,
  SEASON_PASS_SHIRT_SIZES,
  SEASON_PASS_SHIPPING_FEE_BAHT,
  SEASON_TIERS,
  getSeasonPublicSaleLimit,
  seasonTierIncludesShirt,
} from "@/lib/season-pass-tiers";
import {
  calculateSeasonPassZoneRanges,
  formatSeasonPassSequence,
  getSeasonPassZoneBarcodeBounds,
  seasonPassBarcodeIsWithinBounds,
} from "@/lib/season-pass-zone-ranges";
import {
  activeSeasonPassOrderWhere,
  expirePendingSeasonPassPurchases,
  newSeasonPassPaymentDeadline,
} from "@/lib/season-pass-expiry";

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
    shirtSize: z.enum(SEASON_PASS_SHIRT_SIZES).optional().or(z.literal("")),
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

    if (seasonTierIncludesShirt(d.tierId) && !d.shirtSize) {
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
  if (!settings.seasonPassBookingOpen) {
    return { ok: false, error: "ขณะนี้ยังไม่เปิดจองตั๋วรายปี" };
  }
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
  const paymentExpiresAt = newSeasonPassPaymentDeadline();

  try {
    // Release expired public holds before selecting inventory. Legacy and staff
    // orders have no deadline and are intentionally left untouched.
    await expirePendingSeasonPassPurchases();
    const result = await prisma.$transaction(async (tx) => {
      // Serialize sale-state changes with order creation. Once CLOSED/STAFF_ONLY commits,
      // no new public order can slip through using a stale pre-transaction check.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('season-pass-sale-phase'))::text AS lock_result`;
      const currentSetting = await tx.ticketPurchaseSetting.findUnique({
        where: { id: 1 },
        select: { seasonPassSalePhase: true },
      });
      if (currentSetting?.seasonPassSalePhase !== "PUBLIC_OPEN") {
        throw new Error("SALE_CLOSED");
      }

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
            ...activeSeasonPassOrderWhere(),
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
          paymentExpiresAt,
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
            shirtSize: seasonTierIncludesShirt(parsed.data.tierId) ? parsed.data.shirtSize || null : null,
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
    if (error instanceof Error && error.message === "SALE_CLOSED") {
      return { ok: false, error: "ขณะนี้ยังไม่เปิดจองตั๋วรายปี" };
    }
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
      const order = await tx.seasonPassOrder.findUnique({
        where: { id: orderId },
        include: { barcode: { select: { id: true } } },
      });
      if (!order) throw new Error("NOT_FOUND");
      if (
        status === "CONFIRMED" &&
        ["vvip-elite", "vip-advanced"].includes(order.tierId) &&
        order.salesChannel === "OFFLINE" &&
        (!order.seatZone || !order.barcode)
      ) {
        throw new Error("DETAILS_REQUIRED");
      }

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
                ...activeSeasonPassOrderWhere(),
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
    if (error instanceof Error && error.message === "DETAILS_REQUIRED") {
      return { error: "กรุณาระบุข้อมูลแพ็กเกจรอบทีมงานให้ครบก่อนยืนยันรายการ" };
    }
    return { error: "อัปเดตไม่สำเร็จ" };
  }
}

const editSeasonPassSchema = z
  .object({
    orderId: z.string().regex(/^[a-z0-9]+$/i),
    customerId: z.string().trim().optional().or(z.literal("")),
    customerName: z.string().trim().min(2, "กรุณากรอกชื่อ").max(100),
    customerPhone: z.string().trim().regex(/^[0-9+\-\s()]{9,15}$/, "เบอร์โทรไม่ถูกต้อง"),
    customerEmail: z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง").max(200).optional().or(z.literal("")),
    seatZone: z.union([z.enum(SEASON_PASS_SEAT_ZONES), z.literal("")]),
    seatNumber: z.string().trim().toUpperCase().max(30).optional().or(z.literal("")),
    barcode: z.string().trim().toUpperCase().max(50).optional().or(z.literal("")),
    confirmZoneTransfer: z.enum(["yes"]).optional(),
    shirtSize: z.enum(SEASON_PASS_SHIRT_SIZES).optional().or(z.literal("")),
    deliveryMethod: z.enum(["SHIPPING", "PICKUP"] as const),
    shipAddress: z.string().trim().max(300).optional().or(z.literal("")),
    shipCity: z.string().trim().max(100).optional().or(z.literal("")),
    shipProvince: z.string().trim().max(100).optional().or(z.literal("")),
    shipPostalCode: z.string().trim().regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นเลข 5 หลัก").optional().or(z.literal("")),
    shipNote: z.string().trim().max(300).optional().or(z.literal("")),
    pickupLocation: z.string().trim().max(200).optional().or(z.literal("")),
    paymentMethod: z.string().trim().max(50),
    offlineReceiptNo: z.string().trim().max(100).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === "SHIPPING") {
      for (const field of ["shipAddress", "shipCity", "shipProvince", "shipPostalCode"] as const) {
        if (!data[field]) ctx.addIssue({ code: "custom", path: [field], message: "กรุณากรอกข้อมูลให้ครบ" });
      }
    } else if (!data.pickupLocation) {
      ctx.addIssue({ code: "custom", path: ["pickupLocation"], message: "กรุณาระบุจุดรับบัตร" });
    }
  });

export type EditSeasonPassState =
  | undefined
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateSeasonPassOrder(
  _previousState: EditSeasonPassState,
  formData: FormData,
): Promise<EditSeasonPassState> {
  await verifyPermission("SEASON_PASSES");
  const parsed = editSeasonPassSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "กรุณาตรวจสอบข้อมูลที่กรอก",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-order-edit:${input.orderId}`}))`;
      const order = await tx.seasonPassOrder.findUnique({
        where: { id: input.orderId },
        include: { barcode: { select: { id: true, barcode: true } } },
      });
      if (!order) throw new Error("NOT_FOUND");
      if (input.deliveryMethod !== order.deliveryMethod) throw new Error("INVALID_DELIVERY");
      const linkedCustomer = order.salesChannel === "OFFLINE"
        ? input.customerId
          ? await tx.customer.findUnique({
              where: { id: input.customerId },
              select: { id: true, name: true, phone: true, email: true },
            })
          : null
        : null;
      if (order.salesChannel === "OFFLINE" && !linkedCustomer) throw new Error("MEMBER_REQUIRED");
      const linkedCustomerPhone = linkedCustomer
        ? normalizeBookingSearchPhone(linkedCustomer.phone ?? "")
        : null;
      if (linkedCustomer && !/^0[689]\d{8}$/.test(linkedCustomerPhone ?? "")) {
        throw new Error("MEMBER_PHONE_REQUIRED");
      }
      const tier = SEASON_TIERS.find((item) => item.id === order.tierId);
      const isOfflineVvip = order.tierId === "vvip-elite" && order.salesChannel === "OFFLINE";
      const canDeferStaffZone = ["vvip-elite", "vip-advanced"].includes(order.tierId) && order.salesChannel === "OFFLINE";
      if (
        !tier ||
        (!input.seatZone && (!canDeferStaffZone || Boolean(order.barcode))) ||
        (input.seatZone && !tier.allowedSeatZones.includes(input.seatZone))
      ) {
        throw new Error("INVALID_ZONE");
      }
      if (order.tierId === "vvip-elite" && !input.seatNumber && !isOfflineVvip) {
        throw new Error("SEAT_REQUIRED");
      }

      const zoneChanged = order.seatZone !== input.seatZone;
      let configuredQuotas: {
        seatZone: string;
        totalSeats: number;
        sponsorReserved: number;
      }[] | null = null;
      let destinationBarcodeBounds: ReturnType<typeof getSeasonPassZoneBarcodeBounds> = null;

      if (zoneChanged && input.seatZone) {
        if (order.barcode && input.confirmZoneTransfer !== "yes") {
          throw new Error("ZONE_TRANSFER_CONFIRMATION_REQUIRED");
        }

        const zonesToLock = [...new Set([order.seatZone, input.seatZone].filter(Boolean))].sort();
        for (const seatZone of zonesToLock) {
          const quotaLockKey = `${order.seasonLabel}:${order.tierId}:${seatZone}`;
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${quotaLockKey}))::text AS lock_result`;
        }

        configuredQuotas = await tx.seasonPassZoneQuota.findMany({
          where: {
            seasonLabel: order.seasonLabel,
            tierId: order.tierId,
            seatZone: { in: [...tier.allowedSeatZones] },
          },
        });
        destinationBarcodeBounds = getSeasonPassZoneBarcodeBounds(
          `PFC26-${tier.priceBaht}-`,
          tier.allowedSeatZones,
          configuredQuotas,
          input.seatZone,
        );

        if (configuredQuotas.length === tier.allowedSeatZones.length) {
          const quota = configuredQuotas.find((item) => item.seatZone === input.seatZone);
          const limit = quota ? Math.max(0, quota.totalSeats - quota.sponsorReserved) : 0;
          if (["PENDING", "CONFIRMED"].includes(order.status)) {
            const active = await tx.seasonPassOrder.count({
              where: {
                id: { not: order.id },
                seasonLabel: order.seasonLabel,
                tierId: order.tierId,
                seatZone: input.seatZone,
                ...activeSeasonPassOrderWhere(),
              },
            });
            if (active >= limit) throw new Error("ZONE_SOLD_OUT");
          }
        }

        if (order.barcode && !destinationBarcodeBounds) {
          throw new Error("ZONE_BARCODE_RANGE_UNCONFIGURED");
        }
      }

      let assignedBarcode = order.barcode;
      if (zoneChanged && input.seatZone && order.barcode) {
        const barcodeLockKey = `season-pass-barcode:${order.barcode.id}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${barcodeLockKey}))::text AS lock_result`;
        const scanCount = await tx.seasonPassScan.count({
          where: { barcodeId: order.barcode.id },
        });
        if (scanCount > 0) throw new Error("BARCODE_HAS_SCANS");
        if (!destinationBarcodeBounds || destinationBarcodeBounds.publicSeatCount <= 0) {
          throw new Error("BARCODE_UNAVAILABLE");
        }

        const availableBarcode = await tx.seasonPassBarcode.findFirst({
          where: {
            tierId: order.tierId,
            seasonLabel: order.seasonLabel,
            isGenerated: true,
            orderId: null,
            barcode: {
              gte: destinationBarcodeBounds.lowerBound,
              lte: destinationBarcodeBounds.upperBound,
            },
            scans: { none: {} },
          },
          orderBy: { barcode: "asc" },
          select: { id: true, barcode: true },
        });
        if (!availableBarcode) throw new Error("BARCODE_UNAVAILABLE");

        await tx.seasonPassBarcode.update({
          where: { id: order.barcode.id },
          data: {
            orderId: null,
            assignedAt: null,
            usesRemaining: SEASON_MATCHES,
          },
        });
        const claimed = await tx.seasonPassBarcode.updateMany({
          where: { id: availableBarcode.id, orderId: null, isGenerated: true },
          data: { orderId: order.id, assignedAt: new Date(), usesRemaining: SEASON_MATCHES },
        });
        if (claimed.count !== 1) throw new Error("BARCODE_UNAVAILABLE");
        assignedBarcode = availableBarcode;
      } else if (isOfflineVvip && input.barcode && input.barcode !== order.barcode?.barcode) {
        if (order.barcode) {
          const barcodeLockKey = `season-pass-barcode:${order.barcode.id}`;
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${barcodeLockKey}))::text AS lock_result`;
          const scanCount = await tx.seasonPassScan.count({
            where: { barcodeId: order.barcode.id },
          });
          if (scanCount > 0) throw new Error("BARCODE_HAS_SCANS");
        }

        if (!configuredQuotas) {
          configuredQuotas = await tx.seasonPassZoneQuota.findMany({
            where: {
              seasonLabel: order.seasonLabel,
              tierId: order.tierId,
              seatZone: { in: [...tier.allowedSeatZones] },
            },
          });
        }
        destinationBarcodeBounds = input.seatZone
          ? getSeasonPassZoneBarcodeBounds(
              `PFC26-${tier.priceBaht}-`,
              tier.allowedSeatZones,
              configuredQuotas,
              input.seatZone,
            )
          : null;
        if (
          destinationBarcodeBounds &&
          !seasonPassBarcodeIsWithinBounds(input.barcode, destinationBarcodeBounds)
        ) {
          throw new Error("BARCODE_OUTSIDE_ZONE");
        }

        const availableBarcode = await tx.seasonPassBarcode.findFirst({
          where: {
            barcode: input.barcode,
            tierId: order.tierId,
            seasonLabel: order.seasonLabel,
            isGenerated: true,
            orderId: null,
            scans: { none: {} },
          },
          select: { id: true, barcode: true },
        });
        if (!availableBarcode) throw new Error("BARCODE_UNAVAILABLE");
        if (order.barcode) {
          await tx.seasonPassBarcode.update({
            where: { id: order.barcode.id },
            data: {
              orderId: null,
              assignedAt: null,
              usesRemaining: SEASON_MATCHES,
            },
          });
        }
        const claimed = await tx.seasonPassBarcode.updateMany({
          where: { id: availableBarcode.id, orderId: null, isGenerated: true },
          data: { orderId: order.id, assignedAt: new Date(), usesRemaining: SEASON_MATCHES },
        });
        if (claimed.count !== 1) throw new Error("BARCODE_UNAVAILABLE");
        assignedBarcode = availableBarcode;
      }
      if (order.tierId === "vip-advanced" && order.salesChannel === "OFFLINE" && !order.barcode && input.seatZone) {
        const barcodePrefix = `PFC26-${tier.priceBaht}-`;
        if (!configuredQuotas) {
          configuredQuotas = await tx.seasonPassZoneQuota.findMany({
            where: {
              seasonLabel: order.seasonLabel,
              tierId: order.tierId,
              seatZone: { in: [...tier.allowedSeatZones] },
            },
          });
        }
        destinationBarcodeBounds = getSeasonPassZoneBarcodeBounds(
          barcodePrefix,
          tier.allowedSeatZones,
          configuredQuotas,
          input.seatZone,
        );
        if (!destinationBarcodeBounds) throw new Error("ZONE_BARCODE_RANGE_UNCONFIGURED");
        const availableBarcode = await tx.seasonPassBarcode.findFirst({
          where: {
            tierId: order.tierId,
            seasonLabel: order.seasonLabel,
            isGenerated: true,
            orderId: null,
            barcode: {
              gte: destinationBarcodeBounds.lowerBound,
              lte: destinationBarcodeBounds.upperBound,
            },
            scans: { none: {} },
          },
          orderBy: { barcode: "asc" },
          select: { id: true, barcode: true },
        });
        if (!availableBarcode) throw new Error("BARCODE_UNAVAILABLE");
        const claimed = await tx.seasonPassBarcode.updateMany({
          where: { id: availableBarcode.id, orderId: null, isGenerated: true },
          data: { orderId: order.id, assignedAt: new Date(), usesRemaining: SEASON_MATCHES },
        });
        if (claimed.count !== 1) throw new Error("BARCODE_UNAVAILABLE");
        assignedBarcode = availableBarcode;
      }

      const detailsComplete = Boolean(input.seatZone && assignedBarcode);
      const updatedOrder = await tx.seasonPassOrder.update({
        where: { id: order.id },
        data: {
          customerId: linkedCustomer ? linkedCustomer.id : order.customerId,
          customerName: linkedCustomer ? linkedCustomer.name : input.customerName,
          customerPhone: linkedCustomerPhone ?? input.customerPhone,
          customerEmail: linkedCustomer ? linkedCustomer.email : input.customerEmail || null,
          seatZone: input.seatZone,
          seatNumber: input.seatNumber || null,
          shirtSize: input.shirtSize || null,
          deliveryMethod: input.deliveryMethod,
          shipAddress: input.deliveryMethod === "SHIPPING" ? input.shipAddress || null : null,
          shipCity: input.deliveryMethod === "SHIPPING" ? input.shipCity || null : null,
          shipProvince: input.deliveryMethod === "SHIPPING" ? input.shipProvince || null : null,
          shipPostalCode: input.deliveryMethod === "SHIPPING" ? input.shipPostalCode || null : null,
          shipNote: input.deliveryMethod === "SHIPPING" ? input.shipNote || null : null,
          pickupLocation: input.deliveryMethod === "PICKUP" ? input.pickupLocation || null : null,
          ...(order.salesChannel === "OFFLINE" ? { paymentMethod: input.paymentMethod } : {}),
          offlineReceiptNo: order.salesChannel === "OFFLINE" ? input.offlineReceiptNo || null : order.offlineReceiptNo,
          notes: input.notes || null,
          ...(assignedBarcode && assignedBarcode.barcode !== order.passCode
            ? { passCode: assignedBarcode.barcode }
            : {}),
          ...(canDeferStaffZone && order.status === "PENDING" && detailsComplete ? { status: "CONFIRMED" } : {}),
        },
        select: { passCode: true },
      });
      return { oldPassCode: order.passCode, newPassCode: updatedOrder.passCode };
    });
    revalidatePath("/admin/season-passes");
    revalidatePath("/admin/season-passes/check");
    revalidatePath("/admin/season-passes/staff");
    revalidatePath("/admin/members");
    revalidatePath("/member");
    revalidatePath(`/tickets/season/${result.oldPassCode}`);
    if (result.newPassCode !== result.oldPassCode) {
      revalidatePath(`/tickets/season/${result.newPassCode}`);
    }
    revalidateTag("bookings", { expire: 0 });
    revalidateSeatAvailability();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_REQUIRED") return { ok: false, error: "กรุณาเลือกสมาชิกที่สมัครแล้วสำหรับรายการรอบทีมงาน", fieldErrors: { customerId: ["กรุณาเลือกสมาชิก"] } };
    if (error instanceof Error && error.message === "MEMBER_PHONE_REQUIRED") return { ok: false, error: "สมาชิกที่เลือกยังไม่มีเบอร์โทรศัพท์ที่ถูกต้อง กรุณาแก้ไขข้อมูลสมาชิกก่อน", fieldErrors: { customerId: ["ข้อมูลสมาชิกไม่มีเบอร์โทรศัพท์ที่ถูกต้อง"] } };
    if (error instanceof Error && error.message === "INVALID_ZONE") return { ok: false, error: "โซนไม่ตรงกับแพ็กเกจนี้" };
    if (error instanceof Error && error.message === "INVALID_DELIVERY") return { ok: false, error: "ไม่สามารถเปลี่ยนวิธีรับบัตรหลังสร้างรายการได้" };
    if (error instanceof Error && error.message === "SEAT_REQUIRED") return { ok: false, error: "แพ็กเกจ VVIP ต้องระบุหมายเลขที่นั่ง" };
    if (error instanceof Error && error.message === "ZONE_SOLD_OUT") return { ok: false, error: "โซนที่เลือกเต็มตามโควตาแล้ว" };
    if (error instanceof Error && error.message === "BARCODE_UNAVAILABLE") return { ok: false, error: "บาร์โค้ดนี้ไม่พร้อมใช้งานหรือถูกจองไปแล้ว" };
    if (error instanceof Error && error.message === "BARCODE_HAS_SCANS") return { ok: false, error: "ไม่สามารถเปลี่ยนบาร์โค้ดที่มีประวัติการสแกนแล้วได้ เพื่อป้องกันข้อมูลการใช้งานสูญหาย" };
    if (error instanceof Error && error.message === "ZONE_TRANSFER_CONFIRMATION_REQUIRED") {
      return { ok: false, error: "กรุณายืนยันการย้ายโซนและการเปลี่ยนบาร์โค้ดก่อนบันทึก" };
    }
    if (error instanceof Error && error.message === "ZONE_BARCODE_RANGE_UNCONFIGURED") {
      return { ok: false, error: "ยังไม่ได้กำหนดช่วงเลขบาร์โค้ดของทุกโซนในแพ็กเกจนี้ จึงยังย้ายโซนอย่างปลอดภัยไม่ได้" };
    }
    if (error instanceof Error && error.message === "BARCODE_OUTSIDE_ZONE") {
      return { ok: false, error: "เลขบาร์โค้ดที่เลือกไม่อยู่ในช่วงเลขของโซนนี้" };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "หมายเลขที่นั่งนี้ถูกใช้งานแล้ว" };
    }
    return { ok: false, error: "บันทึกการแก้ไขไม่สำเร็จ" };
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
