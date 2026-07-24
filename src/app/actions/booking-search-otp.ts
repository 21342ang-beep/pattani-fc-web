"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  BOOKING_SEARCH_OTP_COOKIE,
  normalizeBookingSearchPhone,
} from "@/lib/booking-search-otp";

const OTP_TTL_MS = 10 * 60_000;
const phoneSchema = z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/);
const pinSchema = z.string().trim().regex(/^\d{4,8}$/);

export type BookingSearchResult = {
  bookingCode: string;
  status: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  match: { homeTeam: string; awayTeam: string; kickoffAt: string | null };
};

export type RequestBookingSearchOtpState =
  | { error: string }
  | { requested: true; phone: string; customerName: string; reference: string | null }
  | undefined;

export type VerifyBookingSearchOtpState =
  | { error: string }
  | { verified: true; results: BookingSearchResult[] }
  | undefined;

function getCredentials() {
  const key = process.env.THAIBULKSMS_OTP_KEY;
  const secret = process.env.THAIBULKSMS_OTP_SECRET;
  return key && secret ? { key, secret } : null;
}

async function thaiBulkSmsRequest(path: string, values: Record<string, string>) {
  const response = await fetch(`https://otp.thaibulksms.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data: unknown = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

function responseValue(data: unknown, key: string): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

async function findBookings(phone: string, customerName: string): Promise<BookingSearchResult[]> {
  const bookingRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Booking"
    WHERE regexp_replace("customerPhone", '\\D', '', 'g') = ${phone}
  `;
  if (bookingRows.length === 0) return [];

  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingRows.map((row) => row.id) },
      ...(customerName
        ? { customerName: { contains: customerName, mode: "insensitive" } }
        : {}),
    },
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

  return bookings.map((booking) => ({
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
}

export async function requestBookingSearchOtp(
  _prev: RequestBookingSearchOtpState,
  formData: FormData,
): Promise<RequestBookingSearchOtpState> {
  const limit = await rateLimit("booking_search_otp_request", {
    max: 3,
    windowMs: 15 * 60_000,
  });
  if (!limit.ok) {
    return { error: `ส่งรหัสบ่อยเกินไป กรุณารอ ${limit.retryAfterSec} วินาที` };
  }

  const parsedPhone = phoneSchema.safeParse(formData.get("customerPhone"));
  if (!parsedPhone.success) {
    return { error: "กรุณากรอกเบอร์โทรศัพท์ที่ใช้จองให้ถูกต้อง" };
  }
  const credentials = getCredentials();
  if (!credentials) {
    return { error: "ระบบยืนยัน OTP ยังไม่ได้ตั้งค่า" };
  }

  const phone = normalizeBookingSearchPhone(parsedPhone.data);
  const recentRows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS "count" FROM "BookingSearchOtp"
    WHERE "phone" = ${phone}
      AND "createdAt" > ${new Date(Date.now() - 15 * 60_000)}
  `;
  const recentForPhone = recentRows[0]?.count ?? 0;
  if (recentForPhone >= 3) {
    return { error: "ส่งรหัสไปยังเบอร์นี้บ่อยเกินไป กรุณาลองใหม่ภายหลัง" };
  }

  try {
    const { ok, data } = await thaiBulkSmsRequest("/v2/otp/request", {
      key: credentials.key,
      secret: credentials.secret,
      msisdn: phone,
    });
    const token = responseValue(data, "token");
    if (!ok || responseValue(data, "status") !== "success" || !token) {
      return { error: "ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่" };
    }

    const reference = responseValue(data, "refno");
    const requestId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await prisma.$executeRaw`
      INSERT INTO "BookingSearchOtp" ("id", "phone", "providerToken", "reference", "expiresAt")
      VALUES (${requestId}, ${phone}, ${token}, ${reference}, ${expiresAt})
    `;
    const cookieStore = await cookies();
    cookieStore.set(BOOKING_SEARCH_OTP_COOKIE, requestId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + OTP_TTL_MS),
    });

    return {
      requested: true,
      phone: parsedPhone.data,
      customerName: String(formData.get("customerName") ?? "").trim(),
      reference,
    };
  } catch {
    return { error: "ไม่สามารถเชื่อมต่อระบบ OTP ได้ กรุณาลองใหม่" };
  }
}

export async function verifyBookingSearchOtp(
  _prev: VerifyBookingSearchOtpState,
  formData: FormData,
): Promise<VerifyBookingSearchOtpState> {
  const limit = await rateLimit("booking_search_otp_verify", {
    max: 5,
    windowMs: 15 * 60_000,
  });
  if (!limit.ok) {
    return { error: `ลองยืนยันรหัสบ่อยเกินไป กรุณารอ ${limit.retryAfterSec} วินาที` };
  }

  const parsedPin = pinSchema.safeParse(formData.get("pin"));
  if (!parsedPin.success) return { error: "กรุณากรอกรหัส OTP ที่ได้รับ" };
  const credentials = getCredentials();
  if (!credentials) return { error: "ระบบยืนยัน OTP ยังไม่ได้ตั้งค่า" };

  const cookieStore = await cookies();
  const requestId = cookieStore.get(BOOKING_SEARCH_OTP_COOKIE)?.value;
  if (!requestId) return { error: "ไม่พบคำขอ OTP กรุณาส่งรหัสใหม่" };

  const requests = await prisma.$queryRaw<{
    id: string;
    phone: string;
    providerToken: string;
    attempts: number;
  }[]>`
    SELECT "id", "phone", "providerToken", "attempts"
    FROM "BookingSearchOtp"
    WHERE "id" = ${requestId}
      AND "expiresAt" > NOW()
      AND "verifiedAt" IS NULL
    LIMIT 1
  `;
  const request = requests[0];
  if (!request) return { error: "รหัส OTP หมดอายุ กรุณาส่งรหัสใหม่" };
  if (request.attempts >= 5) return { error: "กรอกรหัสไม่ถูกต้องหลายครั้ง กรุณาส่งรหัสใหม่" };

  await prisma.$executeRaw`
    UPDATE "BookingSearchOtp"
    SET "attempts" = "attempts" + 1
    WHERE "id" = ${request.id}
  `;

  try {
    const { ok, data } = await thaiBulkSmsRequest("/v2/otp/verify", {
      key: credentials.key,
      secret: credentials.secret,
      token: request.providerToken,
      pin: parsedPin.data,
    });
    if (!ok || responseValue(data, "status") !== "success") {
      return { error: "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" };
    }

    await prisma.$executeRaw`
      UPDATE "BookingSearchOtp"
      SET "verifiedAt" = NOW()
      WHERE "id" = ${request.id}
    `;
    const customerName = String(formData.get("customerName") ?? "").trim();
    const results = await findBookings(request.phone, customerName);
    return { verified: true, results };
  } catch {
    return { error: "ไม่สามารถยืนยันรหัส OTP ได้ กรุณาลองใหม่" };
  }
}
