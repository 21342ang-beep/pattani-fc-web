"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminUser, hasPermission } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";

// ตรวจสอบจองด้วย bookingCode เพียงอย่างเดียว — เฉพาะหลังบ้าน (สิทธิ์ BOOKINGS)
// ความปลอดภัย:
// - bookingCode เป็น cuid (≥24 ตัวอักษร [a-z0-9]) → entropy ~120 บิต → brute force ไม่ได้
// - rate limit 20 ครั้ง / นาที / IP → กัน enumeration script
// - DTO เปิดเผยแค่ชื่อ + รายละเอียดแมตช์ + สถานะ (ไม่มี email/phone) → ลด PII exposure
const lookupSchema = z.object({
  bookingCode: z
    .string()
    .trim()
    .min(8, "รหัสการจองไม่ถูกต้อง")
    .max(50, "รหัสการจองไม่ถูกต้อง")
    .regex(/^[a-z0-9]+$/i, "รหัสการจองไม่ถูกต้อง"),
});

export type BookingLookupResult = {
  bookingCode: string;
  status: string;
  quantity: number;
  totalAmount: number;
  customerName: string;
  createdAt: string;
  match: {
    homeTeam: string;
    awayTeam: string;
    venue: string | null;
    kickoffAt: string | null;
  };
};

export type BookingScanResult =
  | {
      ok: true;
      outcome: "SCANNED" | "ALREADY_SCANNED" | "NOT_ELIGIBLE";
      message: string;
      result: BookingLookupResult & {
        scanCount: number;
        remainingScans: number;
        lastScannedAt: string | null;
      };
    }
  | { ok: false; message: string };

function toBookingResult(b: {
  bookingCode: string;
  status: string;
  quantity: number;
  totalAmount: number;
  customerName: string;
  createdAt: Date;
  match: { homeTeam: string; awayTeam: string; venue: string | null; kickoffAt: Date | null };
}, scanCount: number, lastScannedAt: Date | null) {
  return {
    bookingCode: b.bookingCode,
    status: b.status,
    quantity: b.quantity,
    totalAmount: b.totalAmount,
    customerName: b.customerName,
    createdAt: b.createdAt.toISOString(),
    scanCount,
    remainingScans: Math.max(b.quantity - scanCount, 0),
    lastScannedAt: lastScannedAt?.toISOString() ?? null,
    match: {
      homeTeam: b.match.homeTeam,
      awayTeam: b.match.awayTeam,
      venue: b.match.venue,
      kickoffAt: b.match.kickoffAt?.toISOString() ?? null,
    },
  };
}

const bookingScanSelect = {
  id: true,
  bookingCode: true,
  status: true,
  quantity: true,
  totalAmount: true,
  customerName: true,
  createdAt: true,
  scannedAt: true,
  match: {
    select: { homeTeam: true, awayTeam: true, venue: true, kickoffAt: true },
  },
} as const;

// ล็อกแถวของ booking ใน transaction ก่อนนับ scan เพื่อกันหลายประตูใช้สิทธิ์เกิน quantity
export async function scanBooking(bookingCode: string): Promise<BookingScanResult> {
  const user = await getAdminUser();
  if (!hasPermission(user, "BOOKINGS")) {
    return { ok: false, message: "ไม่มีสิทธิ์สแกนบัตร" };
  }

  const rl = await rateLimit("scan-booking", { max: 300, windowMs: 60_000 });
  if (!rl.ok) {
    return { ok: false, message: `สแกนถี่เกินไป กรุณารอ ${rl.retryAfterSec} วินาที` };
  }

  const parsed = lookupSchema.safeParse({ bookingCode });
  if (!parsed.success) {
    return { ok: false, message: "รูปแบบบาร์โค้ดไม่ถูกต้อง" };
  }

  const response = await prisma.$transaction(async (tx) => {
    // การ update นี้ทำหน้าที่ lock แถวจน transaction จบ เพื่อให้การนับและเพิ่ม scan เป็นลำดับเดียวกัน
    const booking = await tx.booking.update({
      where: { bookingCode: parsed.data.bookingCode },
      data: { updatedAt: new Date() },
      select: {
        ...bookingScanSelect,
        _count: { select: { gateScans: true } },
      },
    }).catch(() => null);
    if (!booking) return { ok: false as const, message: "ไม่พบข้อมูลการจอง" };

    const latestScan = await tx.bookingGateScan.findFirst({
      where: { bookingId: booking.id },
      orderBy: { scannedAt: "desc" },
      select: { scannedAt: true },
    });
    const existingScans = booking._count.gateScans;
    const result = toBookingResult(booking, existingScans, latestScan?.scannedAt ?? null);

    if (booking.status !== "CONFIRMED") {
      return {
        ok: true as const,
        outcome: "NOT_ELIGIBLE" as const,
        message: "ตั๋วใบนี้ยังไม่ยืนยันการชำระเงิน หรือไม่สามารถใช้งานได้",
        result,
      };
    }
    if (existingScans >= booking.quantity) {
      return {
        ok: true as const,
        outcome: "ALREADY_SCANNED" as const,
        message: `สแกนแล้ว ใช้สิทธิ์ครบ ${booking.quantity}/${booking.quantity} ใบ`,
        result,
      };
    }

    const scannedAt = new Date();
    await tx.bookingGateScan.create({
      data: { bookingId: booking.id, scannedAt, scannedBy: user.id },
    });
    if (!booking.scannedAt) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { scannedAt, scannedBy: user.id },
      });
    }
    return {
      ok: true as const,
      outcome: "SCANNED" as const,
      message: `บันทึกการใช้งานแล้ว ${existingScans + 1}/${booking.quantity} ใบ`,
      result: toBookingResult(booking, existingScans + 1, scannedAt),
    };
  });

  if (response.ok && response.outcome === "SCANNED") {
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/bookings/check");
  }
  return response;
}

// ใช้สำหรับล้างผลสแกนในการทดสอบ — ลบแล้วคืนโควตาตั๋ว 1 ใบให้ booking นั้น
export async function deleteBookingGateScan(scanId: string): Promise<{ ok: true } | { error: string }> {
  const user = await getAdminUser();
  if (!hasPermission(user, "BOOKINGS")) return { error: "ไม่มีสิทธิ์ลบข้อมูลการสแกน" };
  if (!z.string().regex(/^[a-z0-9]+$/i).safeParse(scanId).success) {
    return { error: "รหัสรายการสแกนไม่ถูกต้อง" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const scan = await tx.bookingGateScan.findUnique({
        where: { id: scanId },
        select: { id: true, bookingId: true },
      });
      if (!scan) throw new Error("NOT_FOUND");
      await tx.bookingGateScan.delete({ where: { id: scan.id } });
      const remaining = await tx.bookingGateScan.count({ where: { bookingId: scan.bookingId } });
      if (remaining === 0) {
        await tx.booking.update({
          where: { id: scan.bookingId },
          data: { scannedAt: null, scannedBy: null },
        });
      }
    });
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/bookings/check");
    return { ok: true };
  } catch {
    return { error: "ลบข้อมูลการสแกนไม่สำเร็จ" };
  }
}

export type LookupState =
  | { error?: string; result?: undefined }
  | { error?: undefined; result: BookingLookupResult }
  | undefined;

export async function lookupBooking(
  _prev: LookupState,
  formData: FormData
): Promise<LookupState> {
  // getAdminUser redirect ไป /login เองถ้าไม่มี session
  const user = await getAdminUser();
  if (!hasPermission(user, "BOOKINGS")) {
    return { error: "ไม่มีสิทธิ์ตรวจสอบการจอง" };
  }

  // rate limit ก่อน parse → ตัด traffic abuse ที่ถนน
  const rl = await rateLimit("lookup-booking", {
    max: 20,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return { error: `ตรวจสอบบ่อยเกินไป รออีก ${rl.retryAfterSec} วินาที` };
  }

  const parsed = lookupSchema.safeParse({
    bookingCode: formData.get("bookingCode"),
  });
  if (!parsed.success) {
    return { error: "ไม่พบการจองที่ตรงกับข้อมูลที่ระบุ" };
  }

  const b = await prisma.booking.findUnique({
    where: { bookingCode: parsed.data.bookingCode },
    select: {
      bookingCode: true,
      status: true,
      quantity: true,
      totalAmount: true,
      customerName: true,
      createdAt: true,
      match: {
        select: { homeTeam: true, awayTeam: true, venue: true, kickoffAt: true },
      },
    },
  });

  // generic error → ไม่บอกว่ารหัสมีจริงมั้ย กัน enumeration
  if (!b) {
    return { error: "ไม่พบการจองที่ตรงกับข้อมูลที่ระบุ" };
  }

  return {
    result: {
      bookingCode: b.bookingCode,
      status: b.status,
      quantity: b.quantity,
      totalAmount: b.totalAmount,
      customerName: b.customerName,
      createdAt: b.createdAt.toISOString(),
      match: {
        homeTeam: b.match.homeTeam,
        awayTeam: b.match.awayTeam,
        venue: b.match.venue,
        kickoffAt: b.match.kickoffAt?.toISOString() ?? null,
      },
    },
  };
}
