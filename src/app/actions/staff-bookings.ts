"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { activeBookingStatusWhere } from "@/lib/booking-expiry";
import { normalizeBookingSearchPhone } from "@/lib/booking-search-otp";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  getStadiumZone,
  getZoneCapacity,
  getZoneCapacityScope,
  getZonePrice,
  type StadiumZoneCode,
} from "@/lib/stadium-zones";

const HOLD_MINUTES = [15, 30, 60, 240, 1440] as const;

const staffBookingSchema = z.object({
  requestId: z.string().uuid(),
  matchId: z.string().regex(/^[a-z0-9]+$/i),
  zone: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{0,19}$/),
  customerName: z.string().trim().min(2, "กรุณากรอกชื่อลูกค้า").max(100),
  customerPhone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง"),
  customerEmail: z.union([z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200), z.literal("")]),
  quantity: z.number().int().positive(),
  paymentChoice: z.enum(["PAY_LATER", "OFFLINE_CASH", "OFFLINE_TRANSFER"]),
  holdMinutes: z.number().int().refine(
    (value): value is (typeof HOLD_MINUTES)[number] => HOLD_MINUTES.includes(value as (typeof HOLD_MINUTES)[number]),
    "ระยะเวลาสำรองไม่ถูกต้อง",
  ),
  offlineReceiptNo: z.string().trim().max(100),
  notes: z.string().trim().max(500),
  confirmDuplicate: z.boolean(),
}).superRefine((data, context) => {
  if (data.paymentChoice === "OFFLINE_TRANSFER" && !data.offlineReceiptNo) {
    context.addIssue({ code: "custom", path: ["offlineReceiptNo"], message: "กรุณากรอกเลขอ้างอิงการโอน" });
  }
});

export type StaffBookingState =
  | undefined
  | { ok: true; bookingCode: string; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; duplicate?: true };

export async function createStaffBooking(
  _previousState: StaffBookingState,
  formData: FormData,
): Promise<StaffBookingState> {
  const user = await verifyPermission("BOOKINGS");
  const parsed = staffBookingSchema.safeParse({
    requestId: formData.get("requestId"),
    matchId: formData.get("matchId"),
    zone: formData.get("zone"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") ?? "",
    quantity: Number(formData.get("quantity") ?? 0),
    paymentChoice: formData.get("paymentChoice"),
    holdMinutes: Number(formData.get("holdMinutes") ?? 30),
    offlineReceiptNo: formData.get("offlineReceiptNo") ?? "",
    notes: formData.get("notes") ?? "",
    confirmDuplicate: formData.get("confirmDuplicate") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "กรุณาตรวจสอบข้อมูลที่กรอก",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;
  const normalizedPhone = normalizeBookingSearchPhone(input.customerPhone);
  if (!/^0\d{8,9}$/.test(normalizedPhone)) {
    return { ok: false, error: "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง", fieldErrors: { customerPhone: ["เบอร์โทรศัพท์ไม่ถูกต้อง"] } };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingRequest = await tx.booking.findUnique({
        where: { staffRequestId: input.requestId },
        select: { bookingCode: true },
      });
      if (existingRequest) return { bookingCode: existingRequest.bookingCode, alreadyCreated: true };

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
        include: { ticketZones: { where: { code: input.zone, isActive: true }, take: 1 } },
      });
      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (match.status !== "ON_SALE") throw new Error("MATCH_NOT_ON_SALE");

      const dynamicZone = match.ticketZones[0];
      const legacyZone = getStadiumZone(input.zone);
      if (!dynamicZone && !legacyZone) throw new Error("ZONE_NOT_FOUND");
      const capacity = dynamicZone?.capacity ?? (legacyZone
        ? getZoneCapacity(match, input.zone as StadiumZoneCode)
        : null);
      const price = dynamicZone?.price ?? (legacyZone
        ? getZonePrice(match, input.zone as StadiumZoneCode)
        : null);
      if (capacity == null) throw new Error("ZONE_NOT_OPEN");
      if (price == null || price <= 0) throw new Error("ZONE_PRICE_MISSING");
      const capacityScope = dynamicZone
        ? [dynamicZone.code]
        : getZoneCapacityScope(match, input.zone as StadiumZoneCode);

      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`match-capacity:${match.id}`}))`);
      const now = new Date();
      await tx.booking.updateMany({
        where: { matchId: match.id, status: "PENDING", paymentExpiresAt: { lte: now } },
        data: { status: "CANCELLED" },
      });

      const activeCustomerBookings = await tx.booking.findMany({
        where: {
          matchId: match.id,
          zone: input.zone,
          ...activeBookingStatusWhere(now),
        },
        select: { bookingCode: true, customerPhone: true },
      });
      const duplicate = activeCustomerBookings.find(
        (booking) => normalizeBookingSearchPhone(booking.customerPhone) === normalizedPhone,
      );
      if (duplicate && !input.confirmDuplicate) throw new Error(`DUPLICATE:${duplicate.bookingCode}`);

      const sold = await tx.booking.aggregate({
        where: { matchId: match.id, zone: { in: capacityScope }, ...activeBookingStatusWhere(now) },
        _sum: { quantity: true },
      });
      const remaining = Math.max(0, capacity - (sold._sum.quantity ?? 0));
      if (input.quantity > remaining) throw new Error(`NOT_ENOUGH_SEATS:${remaining}`);

      const paid = input.paymentChoice !== "PAY_LATER";
      const booking = await tx.booking.create({
        data: {
          matchId: match.id,
          customerName: input.customerName,
          customerPhone: normalizedPhone,
          customerEmail: input.customerEmail || null,
          quantity: input.quantity,
          zone: input.zone,
          totalAmount: price * input.quantity,
          status: paid ? "CONFIRMED" : "PENDING",
          paymentMethod: paid ? input.paymentChoice : null,
          paymentExpiresAt: paid ? null : new Date(now.getTime() + input.holdMinutes * 60 * 1000),
          paidAt: paid ? now : null,
          salesChannel: "STAFF",
          staffRequestId: input.requestId,
          offlineReceiptNo: input.offlineReceiptNo || null,
          soldAt: now,
          soldById: user.id,
          notes: input.notes || null,
          seatNumbers: [],
        },
      });
      await tx.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          action: "STAFF_CREATED",
          actorId: user.id,
          actorLabel: user.name || user.email,
          nextStatus: booking.status,
          details: {
            zone: input.zone,
            quantity: input.quantity,
            paymentChoice: input.paymentChoice,
            duplicateOverride: Boolean(duplicate),
          },
        },
      });
      return { bookingCode: booking.bookingCode, alreadyCreated: false };
    }, { maxWait: 10000, timeout: 15000 });

    revalidateBookingPages(input.matchId);
    return {
      ok: true,
      bookingCode: result.bookingCode,
      message: result.alreadyCreated
        ? `รายการนี้ถูกบันทึกไว้แล้ว รหัส ${result.bookingCode}`
        : `บันทึกการจองโดยทีมงานเรียบร้อย รหัส ${result.bookingCode}`,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("DUPLICATE:")) {
        return { ok: false, duplicate: true, error: `พบการจองที่ยังใช้งานอยู่ของลูกค้ารายนี้ (${error.message.slice(10)}) หากตรวจสอบแล้วให้เลือก “ยืนยันสร้างรายการซ้ำ”` };
      }
      if (error.message.startsWith("NOT_ENOUGH_SEATS:")) {
        return { ok: false, error: `ที่นั่งคงเหลือ ${Number(error.message.slice(17)).toLocaleString("th-TH")} ที่ ไม่เพียงพอ` };
      }
      const messages: Record<string, string> = {
        MATCH_NOT_FOUND: "ไม่พบแมตช์ที่เลือก",
        MATCH_NOT_ON_SALE: "แมตช์นี้ยังไม่เปิดขายหรือปิดขายแล้ว จึงไม่สามารถตัดที่นั่งได้",
        ZONE_NOT_FOUND: "ไม่พบโซนที่เลือก",
        ZONE_NOT_OPEN: "โซนนี้ยังไม่เปิดขายสำหรับแมตช์นี้",
        ZONE_PRICE_MISSING: "โซนนี้ยังไม่ได้กำหนดราคา",
      };
      if (messages[error.message]) return { ok: false, error: messages[error.message] };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "คำขอนี้ถูกบันทึกแล้ว กรุณารีเฟรชหน้าก่อนทำรายการใหม่" };
    }
    return { ok: false, error: "บันทึกการจองโดยทีมงานไม่สำเร็จ กรุณาลองใหม่" };
  }
}

function revalidateBookingPages(matchId: string) {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/staff");
  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidateTag("bookings", { expire: 0 });
}
