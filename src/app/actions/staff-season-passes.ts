"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { normalizeBookingSearchPhone } from "@/lib/booking-search-otp";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  SEASON_LABEL,
  SEASON_MATCHES,
  SEASON_PASS_SEAT_ZONES,
  SEASON_PASS_SHIRT_SIZES,
  SEASON_TIERS,
  getSeasonPublicSaleLimit,
  seasonTierIncludesShirt,
} from "@/lib/season-pass-tiers";
import {
  calculateSeasonPassZoneRanges,
  formatSeasonPassSequence,
} from "@/lib/season-pass-zone-ranges";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";

const staffSeasonPassSchema = z
  .object({
    tierId: z.enum(["vvip-elite", "vip-advanced", "premium", "gold"] as const),
    seatZone: z.union([z.enum(SEASON_PASS_SEAT_ZONES), z.literal("")]),
    barcode: z.string().trim().toUpperCase().max(50),
    seatNumber: z.string().trim().toUpperCase().max(30),
    customerName: z.string().trim().min(2).max(100),
    customerPhone: z.string().transform(normalizeBookingSearchPhone).pipe(z.string().regex(/^0[689]\d{8}$/)),
    customerEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(254)]),
    shirtSize: z.enum(SEASON_PASS_SHIRT_SIZES).optional().or(z.literal("")),
    paymentMethod: z.enum(["OFFLINE_CASH", "OFFLINE_TRANSFER"]),
    offlineReceiptNo: z.string().trim().max(100),
    notes: z.string().trim().max(500),
  })
  .superRefine((data, context) => {
    const tier = SEASON_TIERS.find((item) => item.id === data.tierId);
    if (!data.seatZone && data.tierId !== "vvip-elite") {
      context.addIssue({ code: "custom", path: ["seatZone"], message: "กรุณาเลือกโซน" });
    } else if (data.seatZone && !tier?.allowedSeatZones.includes(data.seatZone)) {
      context.addIssue({
        code: "custom",
        path: ["seatZone"],
        message: "โซนที่นั่งไม่ตรงกับแพ็กเกจที่เลือก",
      });
    }
    if (data.tierId === "vvip-elite" && !data.seatNumber) {
      context.addIssue({ code: "custom", path: ["seatNumber"], message: "กรุณากรอกหมายเลขที่นั่ง VVIP" });
    }
  });

export type StaffSeasonPassState =
  | undefined
  | { ok: true; message: string; passCode: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerStaffSeasonPass(
  _previousState: StaffSeasonPassState,
  formData: FormData,
): Promise<StaffSeasonPassState> {
  const user = await verifyPermission("SEASON_PASSES");
  const parsed = staffSeasonPassSchema.safeParse({
    tierId: formData.get("tierId"),
    seatZone: formData.get("seatZone"),
    barcode: formData.get("barcode") ?? "",
    seatNumber: formData.get("seatNumber") ?? "",
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") ?? "",
    shirtSize: formData.get("shirtSize") ?? "",
    paymentMethod: formData.get("paymentMethod"),
    offlineReceiptNo: formData.get("offlineReceiptNo") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "กรุณาตรวจสอบข้อมูลที่กรอกให้ครบถ้วนและถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const settings = await getTicketPurchaseSettings();
  if (settings.seasonPassSalePhase === "CLOSED") {
    return { ok: false, error: "ปิดการจองบัตรรายปีทั้งหมดอยู่ กรุณาเปลี่ยนเป็นรอบทีมงานหรือเปิดจองทั่วไปก่อน" };
  }

  const input = parsed.data;
  const tier = SEASON_TIERS.find((item) => item.id === input.tierId)!;
  const barcodePrefix = `PFC26-${tier.priceBaht}-`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('season-pass-sale-phase'))::text AS lock_result`;
      const currentSetting = await tx.ticketPurchaseSetting.findUnique({
        where: { id: 1 },
        select: { seasonPassSalePhase: true },
      });
      if (currentSetting?.seasonPassSalePhase === "CLOSED") throw new Error("SALE_CLOSED");

      const quotaLockKey = `${SEASON_LABEL}:${input.tierId}:${input.seatZone}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${quotaLockKey}))::text AS lock_result`;

      let barcodeLowerBound: string | null = null;
      let barcodeUpperBound: string | null = null;

      if (input.tierId !== "vvip-elite") {
        const configuredQuotas = await tx.seasonPassZoneQuota.findMany({
          where: {
            seasonLabel: SEASON_LABEL,
            tierId: input.tierId,
            seatZone: { in: [...tier.allowedSeatZones] },
          },
        });
        const hasCompleteZoneAllocation = configuredQuotas.length === tier.allowedSeatZones.length;
        const zoneRanges = hasCompleteZoneAllocation
          ? calculateSeasonPassZoneRanges(tier.allowedSeatZones, configuredQuotas)
          : [];
        const selectedRange = zoneRanges.find((range) => range.seatZone === input.seatZone);
        const legacyPublicSaleLimit = hasCompleteZoneAllocation ? null : getSeasonPublicSaleLimit(tier);

        barcodeLowerBound = selectedRange
          ? `${barcodePrefix}${formatSeasonPassSequence(selectedRange.publicStartSequence)}`
          : null;
        barcodeUpperBound = selectedRange
          ? `${barcodePrefix}${formatSeasonPassSequence(selectedRange.publicEndSequence)}`
          : legacyPublicSaleLimit == null
            ? null
            : `${barcodePrefix}${formatSeasonPassSequence(legacyPublicSaleLimit)}`;

        if (hasCompleteZoneAllocation) {
          const zoneLimit = selectedRange?.publicSeatCount ?? 0;
          const activeInZone = await tx.seasonPassOrder.count({
            where: {
              seasonLabel: SEASON_LABEL,
              tierId: input.tierId,
              seatZone: input.seatZone,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
          });
          if (activeInZone + 1 > zoneLimit) throw new Error("ZONE_SOLD_OUT");
        }
      }

      const barcode = input.tierId === "vvip-elite" && !input.barcode
        ? null
        : await tx.seasonPassBarcode.findFirst({
            where: {
              tierId: input.tierId,
              seasonLabel: SEASON_LABEL,
              orderId: null,
              isGenerated: true,
              ...(input.tierId === "vvip-elite"
                ? { barcode: input.barcode }
                : barcodeUpperBound
                  ? {
                      barcode: {
                        startsWith: barcodePrefix,
                        ...(barcodeLowerBound ? { gte: barcodeLowerBound } : {}),
                        lte: barcodeUpperBound,
                      },
                    }
                  : { barcode: { startsWith: barcodePrefix } }),
            },
            orderBy: { barcode: "asc" },
            select: { id: true, barcode: true },
          });
      if (!barcode && !(input.tierId === "vvip-elite" && !input.barcode)) throw new Error("SOLD_OUT");

      const passCode = barcode?.barcode ?? `PENDING-VVIP-${randomUUID().slice(0, 8).toUpperCase()}`;
      const detailsComplete = Boolean(input.seatZone && barcode);

      const order = await tx.seasonPassOrder.create({
        data: {
          passCode,
          tierId: input.tierId,
          seatZone: input.seatZone,
          seatNumber: input.seatNumber || null,
          seasonLabel: SEASON_LABEL,
          priceBaht: tier.priceBaht,
          shippingFeeBaht: 0,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail || null,
          deliveryMethod: "PICKUP",
          pickupLocation: "สโมสร",
          shirtSize: seasonTierIncludesShirt(input.tierId) ? input.shirtSize || null : null,
          paymentMethod: input.paymentMethod,
          status: detailsComplete ? "CONFIRMED" : "PENDING",
          salesChannel: "OFFLINE",
          offlineReceiptNo: input.offlineReceiptNo || null,
          soldAt: new Date(),
          soldById: user.id,
          notes: input.notes || null,
        },
        select: { id: true },
      });

      if (barcode) {
        const claimed = await tx.seasonPassBarcode.updateMany({
          where: { id: barcode.id, orderId: null, isGenerated: true },
          data: {
            orderId: order.id,
            assignedAt: new Date(),
            usesRemaining: SEASON_MATCHES,
          },
        });
        if (claimed.count !== 1) throw new Error("SOLD_OUT");
      }
      return { passCode, detailsComplete };
    });

    revalidatePath("/admin/matches");
    revalidatePath("/admin/matches/season-seats");
    revalidatePath("/admin/season-passes");
    revalidatePath("/admin/season-passes/check");
    revalidatePath("/admin/season-passes/staff");
    revalidatePath("/tickets/season");
    revalidateTag("bookings", { expire: 0 });
    return {
      ok: true,
      passCode: result.passCode,
      message: !result.detailsComplete
        ? "บันทึกการจองแพ็กเกจ 4,000 บาทแล้ว กรุณาเพิ่มโซนและบาร์โค้ดภายหลัง"
        : `จองบัตร ${result.passCode} ให้ลูกค้าเรียบร้อยแล้ว`,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "SALE_CLOSED") {
      return { ok: false, error: "ปิดการจองบัตรรายปีทั้งหมดอยู่ กรุณาเปลี่ยนเป็นรอบทีมงานหรือเปิดจองทั่วไปก่อน" };
    }
    if (error instanceof Error && error.message === "ZONE_SOLD_OUT") {
      return { ok: false, error: "โซนนี้เต็มตามโควตาบัตรรายปีแล้ว กรุณาเลือกโซนอื่น" };
    }
    if (error instanceof Error && error.message === "SOLD_OUT") {
      return { ok: false, error: "ไม่มีบาร์โค้ดพร้อมใช้ในแพ็กเกจหรือโซนนี้" };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "หมายเลขที่นั่งหรือบาร์โค้ดนี้ถูกจองแล้ว กรุณาตรวจสอบอีกครั้ง" };
    }
    return { ok: false, error: "จองบัตรรายปีโดยทีมงานไม่สำเร็จ กรุณาลองใหม่" };
  }
}
