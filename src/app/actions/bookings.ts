"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeBookingStatusWhere, newBookingPaymentDeadline } from "@/lib/booking-expiry";
import { bookingCreateSchema } from "@/lib/validations";
import { verifyPermission } from "@/lib/dal";
import { readCustomerSession } from "@/lib/customer-session";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import {
  getStadiumZone,
  getZoneCapacity,
  getZoneCapacityScope,
  getZonePrice,
} from "@/lib/stadium-zones";

export type BookingFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

// สาธารณะ — สร้างการจองได้ทั้ง member และ guest (ไม่ต้องสมัครสมาชิก)
// อีเมลถูกบังคับมาจาก session เท่านั้น (ไม่ trust client) → กัน spoof / abuse
// guest = customerEmail = null, ใช้ phone + bookingCode ในการตรวจสอบจองภายหลัง
export async function createBooking(
  _prev: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  // login เสริม (optional) — ถ้ามี session จะใช้อีเมลของบัญชี
  // ถ้าไม่มี session = guest booking (อีเมล null)
  const session = await readCustomerSession();

  const parsed = bookingCreateSchema.safeParse({
    matchId: formData.get("matchId"),
    zone: formData.get("zone"),
    customerName: formData.get("customerName"),
    customerEmail: session?.email ?? null, // ← session-only, ไม่อ่านจาก form
    customerPhone: formData.get("customerPhone"),
    quantity: Number(formData.get("quantity") ?? 0),
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const settings = await getTicketPurchaseSettings();
  if (parsed.data.quantity > settings.matchMaxQuantity) {
    return {
      fieldErrors: {
        quantity: [`ซื้อได้สูงสุด ${settings.matchMaxQuantity} ใบต่อหนึ่งรายการ`],
      },
    };
  }

  let bookingCode: string;
  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const match = await tx.match.findUnique({
          where: { id: parsed.data.matchId },
          include: {
            ticketZones: {
              where: { code: parsed.data.zone, isActive: true },
              take: 1,
            },
          },
        });
        if (!match) throw new Error("ไม่พบแมตช์ที่ต้องการ");
        if (match.competitionType === "LEAGUE" && !settings.leagueBookingOpen) {
          throw new Error("ขณะนี้ปิดการจองตั๋วบอลลีกชั่วคราว");
        }
        if (match.status !== "ON_SALE") throw new Error("แมตช์นี้ยังไม่เปิดจอง หรือปิดการจองแล้ว");
        // defense-in-depth — แมตช์ ON_SALE ควรมีข้อมูลครบเสมอ (validate ตอน save)
        // ถ้ามาถึงตรงนี้แล้ว field ขาด แสดงว่ามีข้อมูลผิดปกติ — refuse booking
        const dynamicZone = match.ticketZones[0];
        const legacyZone = getStadiumZone(parsed.data.zone);
        if (!dynamicZone && !legacyZone) {
          throw new Error("ข้อมูลแมตช์ยังไม่สมบูรณ์ ไม่สามารถจองได้");
        }

        const capacity = dynamicZone?.capacity ?? (legacyZone
          ? getZoneCapacity(match, parsed.data.zone as Parameters<typeof getZoneCapacity>[1])
          : null);
        if (capacity == null) {
          throw new Error("โซนนี้ยังไม่เปิดขายสำหรับแมตช์นี้");
        }
        const price = dynamicZone?.price ?? (legacyZone
          ? getZonePrice(match, parsed.data.zone as Parameters<typeof getZonePrice>[1])
          : null);
        if (price == null || price <= 0) {
          throw new Error("โซนนี้ยังไม่ได้กำหนดราคา ไม่สามารถจองได้");
        }

        const capacityScope = dynamicZone
          ? [dynamicZone.code]
          : getZoneCapacityScope(match, parsed.data.zone as Parameters<typeof getZoneCapacityScope>[1]);
        // Serialize capacity checks for this match so two simultaneous requests
        // cannot both claim the same final seats.
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`match-capacity:${match.id}`}))`);
        const now = new Date();
        await tx.booking.updateMany({
          where: {
            matchId: match.id,
            status: "PENDING",
            paymentExpiresAt: { lte: now },
          },
          data: { status: "CANCELLED" },
        });
        const sold = await tx.booking.aggregate({
          where: {
            matchId: match.id,
            zone: { in: capacityScope },
            ...activeBookingStatusWhere(now),
          },
          _sum: { quantity: true },
        });
        const remaining = Math.max(0, capacity - (sold._sum.quantity ?? 0));
        if (parsed.data.quantity > remaining) {
          throw new Error(`ที่นั่งเหลือ ${remaining} ที่ ไม่พอ`);
        }

        // ใช้ `match: { connect }` แทน `matchId` — ชัดเจน + รองรับ
        // client เวอร์ชั่นเก่าใน dev memory cache (กัน error "match is missing")
        return tx.booking.create({
          data: {
            match: { connect: { id: match.id } },
            customerName: parsed.data.customerName,
            customerEmail: parsed.data.customerEmail ?? null,
            customerPhone: parsed.data.customerPhone,
            quantity: parsed.data.quantity,
            zone: parsed.data.zone,
            totalAmount: price * parsed.data.quantity,
            paymentExpiresAt: newBookingPaymentDeadline(now),
            notes: parsed.data.notes,
          },
        });
      },
      // เพิ่ม wait ให้ทนกับ cold-compile/hot-reload ใน Turbopack dev
      // (ใน prod เร็วกว่านี้มาก ไม่กระทบประสิทธิภาพ)
      { maxWait: 10000, timeout: 15000 }
    );
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath("/matches");
    revalidatePath(`/matches/${parsed.data.matchId}`);
    // invalidate unstable_cache queries — ที่นั่งเหลือต้องอัปเดตทันที
    revalidateTag("bookings", { expire: 0 });
    bookingCode = booking.bookingCode;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }

  // ข้าม intermediate "จองสำเร็จ" — ไป checkout ทันที เพื่อไม่ให้
  // PENDING booking ค้าง แล้วกันที่นั่งของลูกค้ารายอื่น
  // (redirect throws NEXT_REDIRECT → ต้องเรียกนอก try/catch)
  redirect(
    `/checkout/${bookingCode}?phone=${encodeURIComponent(parsed.data.customerPhone)}`
  );
}

// Admin — เปลี่ยนสถานะการจอง
export async function updateBookingStatus(
  bookingId: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED"
): Promise<{ ok: true } | { error: string }> {
  const user = await verifyPermission("BOOKINGS");
  if (!/^[a-z0-9]+$/i.test(bookingId) || !["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"].includes(status)) {
    return { error: "ข้อมูลสถานะไม่ถูกต้อง" };
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!current) throw new Error("BOOKING_NOT_FOUND");
      if (current.status === status) return { booking: current, expired: false };
      if (current.status === "REFUNDED") throw new Error("REFUNDED_IS_FINAL");
      if (current.status === "CANCELLED") throw new Error("CANCELLED_IS_FINAL");
      if (current.status === "CONFIRMED" && status !== "REFUNDED") throw new Error("CONFIRMED_REQUIRES_REFUND");
      if (current.status === "PENDING" && !["CONFIRMED", "CANCELLED"].includes(status)) throw new Error("INVALID_TRANSITION");
      const now = new Date();
      if (status === "CONFIRMED" && current.paymentExpiresAt && current.paymentExpiresAt <= now) {
        const cancelled = await tx.booking.update({ where: { id: current.id }, data: { status: "CANCELLED" } });
        await tx.bookingAuditLog.create({
          data: {
            bookingId: current.id,
            bookingCode: current.bookingCode,
            action: "STATUS_CHANGED",
            actorId: user.id,
            actorLabel: user.name || user.email,
            previousStatus: current.status,
            nextStatus: "CANCELLED",
            details: { reason: "payment_expired_during_manual_confirmation" },
          },
        });
        return { booking: cancelled, expired: true };
      }
      const updated = await tx.booking.update({
        where: { id: current.id },
        data: {
          status,
          ...(status === "CONFIRMED" ? { paidAt: current.paidAt ?? now, paymentExpiresAt: null } : {}),
        },
      });
      await tx.bookingAuditLog.create({
        data: {
          bookingId: current.id,
          bookingCode: current.bookingCode,
          action: "STATUS_CHANGED",
          actorId: user.id,
          actorLabel: user.name || user.email,
          previousStatus: current.status,
          nextStatus: status,
        },
      });
      return { booking: updated, expired: false };
    });
    const booking = result.booking;
    revalidatePath("/admin/bookings");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath(`/matches/${booking.matchId}`);
    revalidateTag("bookings", { expire: 0 });
    if (result.expired) return { error: "รายการนี้หมดเวลาชำระแล้วและถูกยกเลิก ไม่สามารถยืนยันย้อนหลังได้" };
    return { ok: true };
  } catch (error) {
    const messages: Record<string, string> = {
      BOOKING_NOT_FOUND: "ไม่พบรายการจอง",
      REFUNDED_IS_FINAL: "รายการคืนเงินแล้วไม่สามารถเปลี่ยนสถานะได้",
      CANCELLED_IS_FINAL: "รายการยกเลิกแล้วไม่สามารถเปิดกลับได้ กรุณาสร้างรายการใหม่เพื่อให้ระบบตรวจที่นั่งอีกครั้ง",
      CONFIRMED_REQUIRES_REFUND: "รายการยืนยันรับเงินแล้วต้องเปลี่ยนเป็น REFUNDED เท่านั้น ห้ามยกเลิกข้ามขั้นตอน",
      INVALID_TRANSITION: "ไม่สามารถเปลี่ยนสถานะตามลำดับนี้ได้",
    };
    return { error: error instanceof Error && messages[error.message] ? messages[error.message] : "อัปเดตไม่สำเร็จ" };
  }
}

// Admin — ลบรายการจอง (หลังจบแมตช์, ทำความสะอาดข้อมูล)
// validate bookingId format → กัน inject ผ่าน params
export async function deleteBooking(
  bookingId: string
): Promise<{ ok: true } | { error: string }> {
  const user = await verifyPermission("BOOKINGS");
  if (typeof bookingId !== "string" || !/^[a-z0-9]+$/i.test(bookingId)) {
    return { error: "รหัสไม่ถูกต้อง" };
  }
  try {
    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!current) throw new Error("BOOKING_NOT_FOUND");
      if (current.status !== "CANCELLED") throw new Error("DELETE_CANCELLED_ONLY");
      await tx.bookingAuditLog.create({
        data: {
          bookingId: current.id,
          bookingCode: current.bookingCode,
          action: "DELETED",
          actorId: user.id,
          actorLabel: user.name || user.email,
          previousStatus: current.status,
          details: { salesChannel: current.salesChannel },
        },
      });
      await tx.booking.delete({ where: { id: current.id } });
      return current;
    });
    revalidatePath("/admin/bookings");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath(`/matches/${booking.matchId}`);
    revalidateTag("bookings", { expire: 0 });
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "DELETE_CANCELLED_ONLY") {
      return { error: "ลบได้เฉพาะรายการที่ยกเลิกแล้วเท่านั้น รายการรับเงินต้องเก็บไว้เป็นหลักฐาน" };
    }
    return { error: "ลบไม่สำเร็จ" };
  }
}

// Admin — ลบข้อมูลการจองทั้งหมดสำหรับการทดสอบระบบ
export async function deleteAllBookings(): Promise<
  { ok: true; deleted: number } | { error: string }
> {
  const user = await verifyPermission("BOOKINGS");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.findMany({ where: { status: "CANCELLED" }, select: { id: true, bookingCode: true, salesChannel: true } });
      if (cancelled.length > 0) {
        await tx.bookingAuditLog.createMany({
          data: cancelled.map((booking) => ({
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            action: "DELETED" as const,
            actorId: user.id,
            actorLabel: user.name || user.email,
            previousStatus: "CANCELLED" as const,
            details: { salesChannel: booking.salesChannel, bulkDelete: true },
          })),
        });
      }
      return tx.booking.deleteMany({ where: { status: "CANCELLED" } });
    });
    revalidatePath("/admin/bookings");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath("/matches");
    revalidateTag("bookings", { expire: 0 });
    return { ok: true, deleted: result.count };
  } catch {
    return { error: "ลบข้อมูลการจองไม่สำเร็จ" };
  }
}
