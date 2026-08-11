"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { verifyPermission } from "@/lib/dal";
import { normalizeBookingSearchPhone } from "@/lib/booking-search-otp";
import { prisma } from "@/lib/prisma";
import { SEASON_LABEL, SEASON_MATCHES } from "@/lib/season-pass-tiers";

const offlineVvipSchema = z.object({
  barcode: z.string().trim().toUpperCase().regex(/^PFC26-4000-\d{4}$/),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().transform(normalizeBookingSearchPhone).pipe(z.string().regex(/^0[689]\d{8}$/)),
  customerEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(254)]),
  seatZone: z.enum(["VVIP-A", "VVIP-B"]),
  seatNumber: z.string().trim().toUpperCase().min(1).max(30),
  shirtSize: z.enum(["S", "M", "L", "XL", "2XL", "3XL"]),
  paymentMethod: z.enum(["OFFLINE_CASH", "OFFLINE_TRANSFER"]),
  offlineReceiptNo: z.string().trim().max(100),
  notes: z.string().trim().max(500),
});

export type OfflineSeasonPassState =
  | undefined
  | { ok: true; message: string; passCode: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerOfflineVvipSeasonPass(
  _previousState: OfflineSeasonPassState,
  formData: FormData,
): Promise<OfflineSeasonPassState> {
  const user = await verifyPermission("SEASON_PASSES");
  const parsed = offlineVvipSchema.safeParse({
    barcode: formData.get("barcode"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail"),
    seatZone: formData.get("seatZone"),
    seatNumber: formData.get("seatNumber"),
    shirtSize: formData.get("shirtSize"),
    paymentMethod: formData.get("paymentMethod"),
    offlineReceiptNo: formData.get("offlineReceiptNo"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "กรุณาตรวจสอบข้อมูลที่กรอกให้ครบถ้วนและถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('season-pass-sale-phase'))::text AS lock_result`;
      const currentSetting = await tx.ticketPurchaseSetting.findUnique({
        where: { id: 1 },
        select: { seasonPassSalePhase: true },
      });
      if (currentSetting?.seasonPassSalePhase === "CLOSED") throw new Error("SALE_CLOSED");

      const barcode = await tx.seasonPassBarcode.findFirst({
        where: {
          barcode: input.barcode,
          tierId: "vvip-elite",
          seasonLabel: SEASON_LABEL,
          isGenerated: true,
        },
        select: { id: true, orderId: true },
      });
      if (!barcode) throw new Error("BARCODE_NOT_FOUND");
      if (barcode.orderId) throw new Error("BARCODE_ASSIGNED");

      const order = await tx.seasonPassOrder.create({
        data: {
          passCode: input.barcode,
          tierId: "vvip-elite",
          seatZone: input.seatZone,
          seatNumber: input.seatNumber,
          seasonLabel: SEASON_LABEL,
          priceBaht: 4000,
          shippingFeeBaht: 0,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail || null,
          deliveryMethod: "PICKUP",
          pickupLocation: "สโมสร",
          shirtSize: input.shirtSize,
          paymentMethod: input.paymentMethod,
          status: "CONFIRMED",
          salesChannel: "OFFLINE",
          offlineReceiptNo: input.offlineReceiptNo || null,
          soldAt: new Date(),
          soldById: user.id,
          notes: input.notes || null,
        },
        select: { id: true },
      });

      const claimed = await tx.seasonPassBarcode.updateMany({
        where: { id: barcode.id, orderId: null, isGenerated: true },
        data: { orderId: order.id, assignedAt: new Date(), usesRemaining: SEASON_MATCHES },
      });
      if (claimed.count !== 1) throw new Error("BARCODE_ASSIGNED");
    });

    revalidatePath("/admin/season-passes");
    revalidatePath("/admin/season-passes/check");
    revalidatePath("/admin/season-passes/offline");
    return {
      ok: true,
      passCode: input.barcode,
      message: `ลงทะเบียนบัตร ${input.barcode} เรียบร้อยแล้ว`,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "SALE_CLOSED") {
      return { ok: false, error: "ปิดการจองบัตรรายปีทั้งหมดอยู่ กรุณาเปลี่ยนเป็นรอบทีมงานหรือเปิดจองทั่วไปก่อน" };
    }
    if (error instanceof Error && error.message === "BARCODE_NOT_FOUND") {
      return { ok: false, error: "ไม่พบบาร์โค้ด VVIP 4,000 นี้ในชุดบาร์โค้ดที่สร้างไว้" };
    }
    if (error instanceof Error && error.message === "BARCODE_ASSIGNED") {
      return { ok: false, error: "บาร์โค้ดนี้ถูกลงทะเบียนให้ลูกค้าแล้ว" };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "ที่นั่งนี้หรือบาร์โค้ดนี้ถูกลงทะเบียนแล้ว กรุณาตรวจสอบอีกครั้ง" };
    }
    return { ok: false, error: "ลงทะเบียนการขายออฟไลน์ไม่สำเร็จ กรุณาลองใหม่" };
  }
}
