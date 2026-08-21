"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { activeBookingStatusWhere } from "@/lib/booking-expiry";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  getStadiumZone,
  getZoneCapacity,
  getZoneCapacityScope,
  getZonePrice,
  type StadiumZoneCode,
} from "@/lib/stadium-zones";

const changeZoneSchema = z.object({
  bookingId: z.string().regex(/^[a-z0-9]+$/i),
  targetZone: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{0,19}$/),
  reason: z.string().trim().min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร").max(300),
  confirmation: z.literal("yes"),
});

export type BookingZoneChangeState =
  | undefined
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function changeConfirmedBookingZone(
  _previousState: BookingZoneChangeState,
  formData: FormData,
): Promise<BookingZoneChangeState> {
  const user = await verifyPermission("BOOKINGS");
  const parsed = changeZoneSchema.safeParse({
    bookingId: formData.get("bookingId"),
    targetZone: formData.get("targetZone"),
    reason: formData.get("reason"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "กรุณาตรวจสอบข้อมูลและยืนยันการเปลี่ยนโซน",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const preliminary = await tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { matchId: true },
      });
      if (!preliminary) throw new Error("BOOKING_NOT_FOUND");
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`match-capacity:${preliminary.matchId}`}))`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Match"
          WHERE "id" = ${preliminary.matchId} FOR SHARE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "BeamPayment"
          WHERE "bookingId" = ${input.bookingId}
          ORDER BY "id" FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "XenditPayment"
          WHERE "bookingId" = ${input.bookingId}
          ORDER BY "id" FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${input.bookingId} FOR UPDATE`,
      );
      const current = await tx.booking.findUnique({
        where: { id: input.bookingId },
        include: {
          beamPayments: { select: { status: true } },
          xenditPayments: { select: { status: true } },
          _count: { select: { gateScans: true } },
        },
      });
      if (!current) throw new Error("BOOKING_NOT_FOUND");
      if (current.status !== "CONFIRMED" || !current.paidAt) {
        throw new Error("BOOKING_NOT_PAID");
      }
      if (current.scannedAt || current._count.gateScans > 0) {
        throw new Error("TICKET_ALREADY_SCANNED");
      }
      if (current.seatNumbers.length > 0) throw new Error("SEATS_ALREADY_ASSIGNED");
      if (!current.zone) throw new Error("CURRENT_ZONE_MISSING");
      if (input.targetZone === current.zone) throw new Error("SAME_ZONE");

      const onlinePaymentVerified =
        current.beamPayments.some((payment) => payment.status === "SUCCEEDED") ||
        current.xenditPayments.some((payment) => payment.status === "SUCCEEDED");
      if (current.salesChannel === "ONLINE" && !onlinePaymentVerified) {
        throw new Error("PAYMENT_NOT_VERIFIED");
      }

      const match = await tx.match.findUnique({
        where: { id: current.matchId },
        include: { ticketZones: { where: { isActive: true } } },
      });
      if (!match) throw new Error("MATCH_NOT_FOUND");
      const now = new Date();
      if (
        match.status === "CANCELLED" ||
        match.status === "FINISHED" ||
        !match.kickoffAt ||
        match.kickoffAt <= now
      ) {
        throw new Error("MATCH_ALREADY_STARTED");
      }

      const dynamicZone = match.ticketZones.find((zone) => zone.code === input.targetZone);
      const legacyZone = getStadiumZone(input.targetZone);
      if (!dynamicZone && !legacyZone) throw new Error("ZONE_NOT_FOUND");

      const capacity = dynamicZone?.capacity ?? (legacyZone
        ? getZoneCapacity(match, input.targetZone as StadiumZoneCode)
        : null);
      const targetPrice = dynamicZone?.price ?? (legacyZone
        ? getZonePrice(match, input.targetZone as StadiumZoneCode)
        : null);
      if (capacity == null || capacity <= 0) throw new Error("ZONE_NOT_OPEN");
      if (targetPrice == null || targetPrice <= 0) throw new Error("ZONE_PRICE_MISSING");
      if (current.quantity <= 0 || current.totalAmount % current.quantity !== 0) {
        throw new Error("BOOKING_PRICE_INVALID");
      }
      const paidUnitPrice = current.totalAmount / current.quantity;
      if (targetPrice !== paidUnitPrice) throw new Error("PRICE_NOT_EQUAL");

      const capacityScope = dynamicZone
        ? [dynamicZone.code]
        : getZoneCapacityScope(match, input.targetZone as StadiumZoneCode);
      const sold = await tx.booking.aggregate({
        where: {
          id: { not: current.id },
          matchId: current.matchId,
          zone: { in: capacityScope },
          ...activeBookingStatusWhere(now),
        },
        _sum: { quantity: true },
      });
      const remaining = Math.max(0, capacity - (sold._sum.quantity ?? 0));
      if (current.quantity > remaining) throw new Error(`NOT_ENOUGH_SEATS:${remaining}`);

      const updated = await tx.booking.update({
        where: { id: current.id },
        data: { zone: input.targetZone },
        select: { bookingCode: true, matchId: true, zone: true },
      });
      await tx.bookingAuditLog.create({
        data: {
          bookingId: current.id,
          bookingCode: current.bookingCode,
          action: "DETAILS_UPDATED",
          actorId: user.id,
          actorLabel: user.name || user.email,
          previousStatus: current.status,
          nextStatus: current.status,
          details: {
            changes: { zone: { from: current.zone, to: input.targetZone } },
            reason: input.reason,
            changeType: "same_price_confirmed_booking_zone_change",
            quantityUnchanged: current.quantity,
            totalAmountUnchanged: current.totalAmount,
          },
        },
      });

      return { ...updated, previousZone: current.zone };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 15_000,
    });

    revalidateZoneChangePages(input.bookingId, result.bookingCode, result.matchId);
    return {
      ok: true,
      message: `เปลี่ยนโซน ${result.previousZone} → ${result.zone} เรียบร้อยแล้ว`,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NOT_ENOUGH_SEATS:")) {
      const remaining = Number(error.message.slice("NOT_ENOUGH_SEATS:".length));
      return { ok: false, error: `โซนเป้าหมายเหลือ ${remaining.toLocaleString("th-TH")} ที่นั่ง ไม่เพียงพอ` };
    }
    const messages: Record<string, string> = {
      BOOKING_NOT_FOUND: "ไม่พบรายการจอง",
      BOOKING_NOT_PAID: "เปลี่ยนโซนได้เฉพาะรายการที่ยืนยันชำระแล้ว",
      TICKET_ALREADY_SCANNED: "ตั๋วรายการนี้ถูกสแกนแล้ว ไม่สามารถเปลี่ยนโซนได้",
      SEATS_ALREADY_ASSIGNED: "รายการนี้มีเลขที่นั่งกำหนดไว้แล้ว ไม่สามารถย้ายโซนด้วยวิธีนี้ได้",
      CURRENT_ZONE_MISSING: "รายการนี้ไม่มีข้อมูลโซนเดิม",
      SAME_ZONE: "กรุณาเลือกโซนใหม่ที่ต่างจากโซนเดิม",
      PAYMENT_NOT_VERIFIED: "ไม่พบหลักฐานการชำระเงินสำเร็จจากผู้ให้บริการ",
      MATCH_NOT_FOUND: "ไม่พบข้อมูลแมตช์",
      MATCH_ALREADY_STARTED: "ไม่สามารถเปลี่ยนโซนหลังเริ่มแข่งขันหรือจบการแข่งขันแล้ว",
      ZONE_NOT_FOUND: "ไม่พบโซนเป้าหมาย",
      ZONE_NOT_OPEN: "โซนเป้าหมายไม่ได้เปิดขายสำหรับแมตช์นี้",
      ZONE_PRICE_MISSING: "โซนเป้าหมายยังไม่ได้กำหนดราคา",
      BOOKING_PRICE_INVALID: "ยอดชำระเดิมไม่สามารถคำนวณเป็นราคาต่อใบได้",
      PRICE_NOT_EQUAL: "ระบบอนุญาตเฉพาะการเปลี่ยนไปโซนที่ราคาเท่ากับยอดที่ชำระต่อใบ",
    };
    return {
      ok: false,
      error: error instanceof Error && messages[error.message]
        ? messages[error.message]
        : "เปลี่ยนโซนไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

function revalidateZoneChangePages(bookingId: string, bookingCode: string, matchId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/change-zone`);
  revalidatePath("/admin/reports");
  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath(`/tickets/${bookingCode}`);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/member/bookings");
  revalidatePath("/bookings/search");
  revalidateTag("bookings", { expire: 0 });
}
