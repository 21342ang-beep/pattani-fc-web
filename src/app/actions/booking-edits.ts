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

const editBookingSchema = z.object({
  bookingId: z.string().regex(/^[a-z0-9]+$/i),
  customerName: z.string().trim().min(2, "กรุณากรอกชื่อลูกค้า").max(100),
  customerPhone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง"),
  customerEmail: z.union([z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200), z.literal("")]),
  notes: z.string().trim().max(500),
  zone: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{0,19}$/),
  quantity: z.number().int().min(1).max(20),
});

export type BookingEditState =
  | undefined
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateBookingDetails(
  _previousState: BookingEditState,
  formData: FormData,
): Promise<BookingEditState> {
  const user = await verifyPermission("BOOKINGS");
  const parsed = editBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") ?? "",
    notes: formData.get("notes") ?? "",
    zone: formData.get("zone"),
    quantity: Number(formData.get("quantity") ?? 0),
  });
  if (!parsed.success) {
    return { ok: false, error: "กรุณาตรวจสอบข้อมูลที่กรอก", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const input = parsed.data;
  const normalizedPhone = normalizeBookingSearchPhone(input.customerPhone);
  if (!/^0\d{8,9}$/.test(normalizedPhone)) {
    return { ok: false, error: "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง", fieldErrors: { customerPhone: ["เบอร์โทรศัพท์ไม่ถูกต้อง"] } };
  }

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
        Prisma.sql`SELECT "id" FROM "BeamPayment"
          WHERE "bookingId" = ${input.bookingId}
          ORDER BY "id" FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "XenditPayment"
          WHERE "bookingId" = ${input.bookingId}
          ORDER BY "id" FOR UPDATE`,
      );
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${input.bookingId} FOR UPDATE`);
      const current = await tx.booking.findUnique({
        where: { id: input.bookingId },
        include: {
          match: { include: { ticketZones: { where: { isActive: true } } } },
          _count: { select: { xenditPayments: true, beamPayments: true } },
        },
      });
      if (!current) throw new Error("BOOKING_NOT_FOUND");
      if (current.status === "CANCELLED" || current.status === "REFUNDED") throw new Error("BOOKING_FINAL");

      const canEditInventory = current.status === "PENDING"
        && current.salesChannel === "STAFF"
        && current.paymentMethod == null
        && current._count.xenditPayments === 0
        && current._count.beamPayments === 0;
      const inventoryChanged = input.zone !== current.zone || input.quantity !== current.quantity;
      if (inventoryChanged && !canEditInventory) throw new Error("INVENTORY_LOCKED");

      const now = new Date();
      if (current.status === "PENDING" && current.paymentExpiresAt && current.paymentExpiresAt <= now) {
        await tx.booking.update({ where: { id: current.id }, data: { status: "CANCELLED" } });
        await tx.bookingAuditLog.create({
          data: {
            bookingId: current.id,
            bookingCode: current.bookingCode,
            action: "STATUS_CHANGED",
            actorId: user.id,
            actorLabel: user.name || user.email,
            previousStatus: "PENDING",
            nextStatus: "CANCELLED",
            details: { reason: "payment_expired_during_edit" },
          },
        });
        return { matchId: current.matchId, expired: true, changed: false };
      }

      let totalAmount = current.totalAmount;
      if (inventoryChanged) {
        const dynamicZone = current.match.ticketZones.find((zone) => zone.code === input.zone);
        const legacyZone = getStadiumZone(input.zone);
        if (!dynamicZone && !legacyZone) throw new Error("ZONE_NOT_FOUND");
        const capacity = dynamicZone?.capacity ?? (legacyZone
          ? getZoneCapacity(current.match, input.zone as StadiumZoneCode)
          : null);
        const price = dynamicZone?.price ?? (legacyZone
          ? getZonePrice(current.match, input.zone as StadiumZoneCode)
          : null);
        if (capacity == null || capacity <= 0) throw new Error("ZONE_NOT_OPEN");
        if (price == null || price <= 0) throw new Error("ZONE_PRICE_MISSING");
        const capacityScope = dynamicZone
          ? [dynamicZone.code]
          : getZoneCapacityScope(current.match, input.zone as StadiumZoneCode);
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
        if (input.quantity > remaining) throw new Error(`NOT_ENOUGH_SEATS:${remaining}`);
        totalAmount = price * input.quantity;
      }

      const nextEmail = input.customerEmail || null;
      const nextNotes = input.notes || null;
      const changes: Record<string, { from: string | number | null; to: string | number | null }> = {};
      addChange(changes, "customerName", current.customerName, input.customerName);
      addChange(changes, "customerPhone", current.customerPhone, normalizedPhone);
      addChange(changes, "customerEmail", current.customerEmail, nextEmail);
      addChange(changes, "notes", current.notes, nextNotes);
      addChange(changes, "zone", current.zone, input.zone);
      addChange(changes, "quantity", current.quantity, input.quantity);
      addChange(changes, "totalAmount", current.totalAmount, totalAmount);
      if (Object.keys(changes).length === 0) {
        return { matchId: current.matchId, expired: false, changed: false };
      }

      await tx.booking.update({
        where: { id: current.id },
        data: {
          customerName: input.customerName,
          customerPhone: normalizedPhone,
          customerEmail: nextEmail,
          notes: nextNotes,
          ...(inventoryChanged ? { zone: input.zone, quantity: input.quantity, totalAmount } : {}),
        },
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
          details: { changes },
        },
      });
      return { matchId: current.matchId, expired: false, changed: true };
    }, { maxWait: 10000, timeout: 15000 });

    revalidateBookingEditPages(input.bookingId, result.matchId);
    if (result.expired) return { ok: false, error: "รายการหมดเวลาชำระแล้ว ระบบจึงยกเลิกและไม่บันทึกการแก้ไข" };
    return { ok: true, message: result.changed ? "บันทึกข้อมูลและประวัติการแก้ไขแล้ว" : "ข้อมูลไม่มีการเปลี่ยนแปลง" };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NOT_ENOUGH_SEATS:")) {
      return { ok: false, error: `ที่นั่งคงเหลือ ${Number(error.message.slice("NOT_ENOUGH_SEATS:".length)).toLocaleString("th-TH")} ที่ ไม่เพียงพอ` };
    }
    const messages: Record<string, string> = {
      BOOKING_NOT_FOUND: "ไม่พบรายการจอง",
      BOOKING_FINAL: "รายการยกเลิกหรือคืนเงินแล้วไม่สามารถแก้ไขได้",
      INVENTORY_LOCKED: "รายการนี้แก้ได้เฉพาะข้อมูลลูกค้าและหมายเหตุ ไม่สามารถเปลี่ยนโซน จำนวน หรือยอดเงินได้",
      ZONE_NOT_FOUND: "ไม่พบโซนที่เลือก",
      ZONE_NOT_OPEN: "โซนนี้ไม่ได้เปิดขายสำหรับแมตช์นี้",
      ZONE_PRICE_MISSING: "โซนนี้ยังไม่ได้กำหนดราคา",
    };
    return { ok: false, error: error instanceof Error && messages[error.message] ? messages[error.message] : "บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่" };
  }
}

function addChange(
  changes: Record<string, { from: string | number | null; to: string | number | null }>,
  field: string,
  from: string | number | null,
  to: string | number | null,
) {
  if (from !== to) changes[field] = { from, to };
}

function revalidateBookingEditPages(bookingId: string, matchId: string) {
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/edit`);
  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath(`/matches/${matchId}`);
  revalidateTag("bookings", { expire: 0 });
}
