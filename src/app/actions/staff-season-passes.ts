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
  getSeasonPassZoneBarcodeBounds,
  resolveSeasonPassBarcodeZoneQuotas,
  seasonPassBarcodeIsWithinBounds,
} from "@/lib/season-pass-zone-ranges";
import { secureSeasonPassGateAssignment } from "@/lib/season-pass-gate-state";

const staffSeasonPassSchema = z
  .object({
    customerMode: z.enum(["EXISTING", "NEW_NAME"]),
    customerId: z.string().trim().max(100),
    newCustomerName: z.string().trim().max(100),
    tierId: z.enum(["vvip-elite", "vip-advanced", "premium", "gold"] as const),
    seatZone: z.union([z.enum(SEASON_PASS_SEAT_ZONES), z.literal("")]),
    barcode: z.union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^PFC26-(4000|2500|2000|1500)-\d{4}$/, "รูปแบบบาร์โค้ดไม่ถูกต้อง"),
      z.literal(""),
    ]),
    seatNumber: z.string().trim().toUpperCase().max(30),
    shirtSize: z.enum(SEASON_PASS_SHIRT_SIZES).optional().or(z.literal("")),
    paymentMethod: z.enum(["OFFLINE_CASH", "OFFLINE_TRANSFER"]),
    offlineReceiptNo: z.string().trim().max(100),
    notes: z.string().trim().max(500),
  })
  .superRefine((data, context) => {
    if (data.customerMode === "EXISTING" && !data.customerId) {
      context.addIssue({ code: "custom", path: ["customerId"], message: "กรุณาเลือกสมาชิก" });
    }
    if (data.customerMode === "NEW_NAME" && data.newCustomerName.length < 2) {
      context.addIssue({ code: "custom", path: ["newCustomerName"], message: "กรุณากรอกชื่อลูกค้า" });
    }
    const tier = SEASON_TIERS.find((item) => item.id === data.tierId);
    if (!data.seatZone && !["vvip-elite", "vip-advanced"].includes(data.tierId)) {
      context.addIssue({ code: "custom", path: ["seatZone"], message: "กรุณาเลือกโซน" });
    } else if (data.seatZone && !tier?.allowedSeatZones.includes(data.seatZone)) {
      context.addIssue({
        code: "custom",
        path: ["seatZone"],
        message: "โซนที่นั่งไม่ตรงกับแพ็กเกจที่เลือก",
      });
    }
    if (data.barcode && !data.seatZone) {
      context.addIssue({
        code: "custom",
        path: ["seatZone"],
        message: "กรุณาเลือกโซนก่อนเลือกเลขรันบาร์โค้ด",
      });
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
    customerMode: formData.get("customerMode") ?? "EXISTING",
    customerId: formData.get("customerId") ?? "",
    newCustomerName: formData.get("newCustomerName") ?? "",
    tierId: formData.get("tierId"),
    seatZone: formData.get("seatZone"),
    barcode: formData.get("barcode") ?? "",
    seatNumber: formData.get("seatNumber") ?? "",
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

  if (parsed.data.tierId !== "vvip-elite") {
    return {
      ok: false,
      error: "รอบทีมงานเปิดให้จองเฉพาะแพ็กเกจ 4,000 บาทเท่านั้น",
      fieldErrors: { tierId: ["แพ็กเกจนี้เปิดจองเฉพาะรอบทั่วไป"] },
    };
  }

  const input = parsed.data;
  const tier = SEASON_TIERS.find((item) => item.id === input.tierId)!;
  const barcodePrefix = `PFC26-${tier.priceBaht}-`;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = input.customerMode === "EXISTING"
        ? await tx.customer.findUnique({
          where: { id: input.customerId },
          select: { id: true, name: true, phone: true, email: true },
        })
        : { id: null, name: input.newCustomerName, phone: "", email: null };
      if (!customer) throw new Error("MEMBER_NOT_FOUND");
      const customerPhone = normalizeBookingSearchPhone(customer.phone ?? "");
      if (input.customerMode === "EXISTING" && !/^0[689]\d{8}$/.test(customerPhone)) {
        throw new Error("MEMBER_PHONE_REQUIRED");
      }

      const quotaLockKey = `${SEASON_LABEL}:${input.tierId}:${input.seatZone}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${quotaLockKey}))::text AS lock_result`;

      let barcodeLowerBound: string | null = null;
      let barcodeUpperBound: string | null = null;
      const configuredQuotas = await tx.seasonPassZoneQuota.findMany({
        where: {
          seasonLabel: SEASON_LABEL,
          tierId: input.tierId,
          seatZone: { in: [...tier.allowedSeatZones] },
        },
      });
      const barcodeZoneQuotas = resolveSeasonPassBarcodeZoneQuotas(
        SEASON_LABEL,
        input.tierId,
        barcodePrefix,
        tier.allowedSeatZones,
        configuredQuotas,
      );
      const selectedBarcodeBounds = input.seatZone
        ? getSeasonPassZoneBarcodeBounds(
            barcodePrefix,
            tier.allowedSeatZones,
            barcodeZoneQuotas,
            input.seatZone,
          )
        : null;
      if (input.barcode && !selectedBarcodeBounds) {
        throw new Error("ZONE_BARCODE_RANGE_UNCONFIGURED");
      }
      if (
        input.barcode &&
        selectedBarcodeBounds &&
        !seasonPassBarcodeIsWithinBounds(input.barcode, selectedBarcodeBounds)
      ) {
        throw new Error("BARCODE_OUTSIDE_ZONE");
      }

      if (input.tierId !== "vvip-elite") {
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

        if (hasCompleteZoneAllocation && input.seatZone) {
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
      } else if (input.seatZone && selectedBarcodeBounds) {
        const activeInZone = await tx.seasonPassOrder.count({
          where: {
            seasonLabel: SEASON_LABEL,
            tierId: input.tierId,
            seatZone: input.seatZone,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        });
        if (activeInZone + 1 > selectedBarcodeBounds.publicSeatCount) {
          throw new Error("ZONE_SOLD_OUT");
        }
      }

      const deferBarcodeAssignment =
        (input.tierId === "vvip-elite" && !input.barcode) ||
        (input.tierId === "vip-advanced" && !input.seatZone);
      const barcode = deferBarcodeAssignment
        ? null
        : await tx.seasonPassBarcode.findFirst({
            where: {
              tierId: input.tierId,
              seasonLabel: SEASON_LABEL,
              orderId: null,
              isGenerated: true,
              scans: { none: {} },
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
      if (!barcode && !deferBarcodeAssignment) throw new Error("SOLD_OUT");

      const pendingTier = input.tierId === "vvip-elite" ? "VVIP" : "VIP";
      const passCode = barcode?.barcode ?? `PENDING-${pendingTier}-${randomUUID().slice(0, 8).toUpperCase()}`;
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
          customerId: customer.id,
          customerName: customer.name,
          customerPhone,
          customerEmail: customer.email,
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
            ...secureSeasonPassGateAssignment(),
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
    revalidatePath("/admin/members");
    revalidatePath("/member");
    revalidatePath("/tickets/season");
    revalidateTag("bookings", { expire: 0 });
    return {
      ok: true,
      passCode: result.passCode,
      message: !result.detailsComplete
        ? input.tierId === "vvip-elite"
          ? "บันทึกการจองแพ็กเกจ 4,000 บาทแล้ว กรุณาเพิ่มโซนและบาร์โค้ดภายหลัง"
          : "บันทึกการจองแพ็กเกจ 2,500 บาทแล้ว กรุณาเพิ่มโซนภายหลัง"
        : `จองบัตร ${result.passCode} ให้ลูกค้าเรียบร้อยแล้ว`,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return { ok: false, error: "ไม่พบบัญชีสมาชิกที่เลือก กรุณาเลือกสมาชิกใหม่", fieldErrors: { customerId: ["ไม่พบบัญชีสมาชิก"] } };
    }
    if (error instanceof Error && error.message === "MEMBER_PHONE_REQUIRED") {
      return { ok: false, error: "สมาชิกที่เลือกยังไม่มีเบอร์โทรศัพท์ที่ถูกต้อง กรุณาแก้ไขข้อมูลสมาชิกก่อนจอง", fieldErrors: { customerId: ["ข้อมูลสมาชิกไม่มีเบอร์โทรศัพท์ที่ถูกต้อง"] } };
    }
    if (error instanceof Error && error.message === "ZONE_SOLD_OUT") {
      return { ok: false, error: "โซนนี้เต็มตามโควตาบัตรรายปีแล้ว กรุณาเลือกโซนอื่น" };
    }
    if (error instanceof Error && error.message === "SOLD_OUT") {
      return { ok: false, error: "ไม่มีบาร์โค้ดพร้อมใช้ในแพ็กเกจหรือโซนนี้", fieldErrors: { barcode: ["กรุณาเลือกเลขรันที่ยังว่างในโซนนี้"] } };
    }
    if (error instanceof Error && error.message === "ZONE_BARCODE_RANGE_UNCONFIGURED") {
      return { ok: false, error: "ยังไม่ได้กำหนดช่วงเลขรันบาร์โค้ดของโซนนี้" };
    }
    if (error instanceof Error && error.message === "BARCODE_OUTSIDE_ZONE") {
      return { ok: false, error: "เลขรันบาร์โค้ดที่เลือกไม่อยู่ในโซนนี้", fieldErrors: { barcode: ["กรุณาเลือกเลขรันของโซนที่เลือก"] } };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "หมายเลขที่นั่งหรือบาร์โค้ดนี้ถูกจองแล้ว กรุณาตรวจสอบอีกครั้ง" };
    }
    return { ok: false, error: "จองบัตรรายปีโดยทีมงานไม่สำเร็จ กรุณาลองใหม่" };
  }
}
