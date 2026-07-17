"use server";

import { z } from "zod";
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
