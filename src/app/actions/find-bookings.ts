"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const searchSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/),
});

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
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
  | { error?: undefined; results: BookingSearchResult[]; phone: string }
  | undefined;

export async function findBookingsByCustomer(
  _prev: BookingSearchState,
  formData: FormData
): Promise<BookingSearchState> {
  const limit = await rateLimit("find-bookings", { max: 10, windowMs: 60_000 });
  if (!limit.ok) return { error: `ค้นหาบ่อยเกินไป กรุณารอ ${limit.retryAfterSec} วินาที` };

  const parsed = searchSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
  });
  if (!parsed.success) return { error: "กรุณากรอกชื่อและเบอร์โทรศัพท์ที่ใช้จองให้ถูกต้อง" };

  const phone = normalizePhone(parsed.data.customerPhone);
  const bookings = await prisma.booking.findMany({
    where: { customerName: { contains: parsed.data.customerName, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      bookingCode: true,
      customerPhone: true,
      status: true,
      quantity: true,
      totalAmount: true,
      createdAt: true,
      match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } },
    },
  });

  const results = bookings
    .filter((booking) => normalizePhone(booking.customerPhone) === phone)
    .slice(0, 10)
    .map((booking) => ({
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

  return { results, phone: parsed.data.customerPhone };
}
