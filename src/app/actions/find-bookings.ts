"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// ค้นหาการจองด้วยชื่อ "หรือ" เบอร์โทร — กรอกอย่างน้อยหนึ่งช่อง
// ใส่ทั้งคู่ = ต้องตรงทั้งคู่ (แคบผลลัพธ์ลง)
const searchSchema = z
  .object({
    customerName: z.string().trim().min(2).max(100).optional(),
    customerPhone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{6,20}$/)
      .optional(),
  })
  .refine((v) => Boolean(v.customerName || v.customerPhone));

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

// "" จาก input ที่เว้นว่าง = ไม่ได้กรอก (ไม่ใช่ค่าที่ไม่ผ่าน validation)
function optionalField(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? undefined : text;
}

export type BookingSearchResult = {
  bookingCode: string;
  status: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  match: { homeTeam: string; awayTeam: string; kickoffAt: string | null };
};

export type BookingSearchState =
  | { error?: string; results?: undefined }
  | { error?: undefined; results: BookingSearchResult[]; phone?: string }
  | undefined;

export async function findBookingsByCustomer(
  _prev: BookingSearchState,
  formData: FormData
): Promise<BookingSearchState> {
  const limit = await rateLimit("find-bookings", { max: 10, windowMs: 60_000 });
  if (!limit.ok) return { error: `ค้นหาบ่อยเกินไป กรุณารอ ${limit.retryAfterSec} วินาที` };

  const parsed = searchSchema.safeParse({
    customerName: optionalField(formData.get("customerName")),
    customerPhone: optionalField(formData.get("customerPhone")),
  });
  if (!parsed.success) {
    return { error: "กรุณากรอกชื่อผู้จอง หรือเบอร์โทรศัพท์ที่ใช้จองอย่างน้อยหนึ่งช่อง" };
  }

  const { customerName, customerPhone } = parsed.data;
  const where: Prisma.BookingWhereInput = {};

  if (customerName) {
    where.customerName = { contains: customerName, mode: "insensitive" };
  }

  // เบอร์ถูกเก็บตามที่ผู้ใช้พิมพ์ (มี - เว้นวรรค วงเล็บได้) → เทียบเฉพาะตัวเลขใน DB
  // ต้องกรองที่ DB ไม่ใช่หลัง take เพราะจะทำให้รายการที่ตรงหลุดออกจากผลลัพธ์
  if (customerPhone) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Booking"
      WHERE regexp_replace("customerPhone", '\\D', '', 'g') = ${normalizePhone(customerPhone)}
    `;
    if (rows.length === 0) return { results: [], phone: customerPhone };
    where.id = { in: rows.map((row) => row.id) };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      bookingCode: true,
      status: true,
      quantity: true,
      totalAmount: true,
      createdAt: true,
      match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } },
    },
  });

  const results = bookings.map((booking) => ({
    bookingCode: booking.bookingCode,
    status: booking.status,
    quantity: booking.quantity,
    totalAmount: booking.totalAmount,
    createdAt: booking.createdAt.toISOString(),
    match: {
      homeTeam: booking.match.homeTeam,
      awayTeam: booking.match.awayTeam,
      kickoffAt: booking.match.kickoffAt?.toISOString() ?? null,
    },
  }));

  return { results, phone: customerPhone };
}
