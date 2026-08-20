"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getOptionalCustomer } from "@/lib/customer-dal";
import { createSeasonPassBarcodeAccessToken } from "@/lib/season-pass-barcode-access";
import { grantBookingRecoveryAccess } from "@/lib/booking-access";
import {
  BOOKING_SEARCH_OTP_COOKIE,
  bookingSearchPhoneVariants,
  normalizeBookingSearchPhone,
} from "@/lib/booking-search-otp";
import {
  claimVerifiedPhoneForCustomer,
  type VerifiedPhoneClaimResult,
} from "@/lib/customer-phone-ownership";

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

export type SeasonPassSearchResult = {
  passCode: string;
  barcodeAccessToken?: string;
  status: string;
  tierId: string;
  priceBaht: number;
  createdAt: string;
};

export type RequestBookingSearchOtpState =
  | { error: string }
  | { requested: true; phone: string; reference: string | null }
  | undefined;

export type BookingSearchResults = {
  bookings: BookingSearchResult[];
  seasonPasses: SeasonPassSearchResult[];
};

export type VerifyBookingSearchOtpState =
  | { error: string }
  | {
      verified: true;
      results: BookingSearchResults;
      phoneLinkWarning?: string;
    }
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
  return { ok: response.ok, status: response.status, data };
}

function responseValue(data: unknown, key: string): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function logOtpProviderFailure(status: number, data: unknown) {
  // Do not log the request body: it contains API credentials and recipient data.
  console.error("ThaiBulkSMS OTP request rejected", {
    status,
    code: responseValue(data, "code"),
    providerStatus: responseValue(data, "status"),
  });
}

async function findBookings(
  phone: string,
  currentCustomerId: string | null,
): Promise<BookingSearchResult[]> {
  const [domesticPhone, internationalPhone] = bookingSearchPhoneVariants(phone);
  const bookingRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Booking"
    WHERE (
      regexp_replace("customerPhone", '\\D', '', 'g') = ${domesticPhone}
      OR regexp_replace("customerPhone", '\\D', '', 'g') = ${internationalPhone}
    )
      AND (
        "customerId" IS NULL
        OR "customerId" = ${currentCustomerId}
      )
  `;
  if (bookingRows.length === 0) return [];

  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingRows.map((row) => row.id) },
    },
    orderBy: { createdAt: "desc" },
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

async function findSeasonPasses(
  phone: string,
  currentCustomerId: string | null,
): Promise<SeasonPassSearchResult[]> {
  const [domesticPhone, internationalPhone] = bookingSearchPhoneVariants(phone);
  const orderRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "SeasonPassOrder"
    WHERE (
      regexp_replace("customerPhone", '\\D', '', 'g') = ${domesticPhone}
      OR regexp_replace("customerPhone", '\\D', '', 'g') = ${internationalPhone}
    )
      AND (
        "customerId" IS NULL
        OR "customerId" = ${currentCustomerId}
      )
  `;
  if (orderRows.length === 0) return [];

  const orders = await prisma.seasonPassOrder.findMany({
    where: {
      id: { in: orderRows.map((row) => row.id) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      passCode: true,
      status: true,
      tierId: true,
      priceBaht: true,
      createdAt: true,
      barcode: {
        select: {
          id: true,
          barcode: true,
          gateVersion: true,
          gateNonce: true,
          orderId: true,
        },
      },
    },
  });

  return Promise.all(
    orders.map(async (order) => ({
      passCode: order.passCode,
      ...(order.status === "CONFIRMED" && order.barcode
        ? {
            barcodeAccessToken:
              await createSeasonPassBarcodeAccessToken({
                barcodeId: order.barcode.id,
                barcode: order.barcode.barcode,
                gateVersion: order.barcode.gateVersion,
                gateNonce: order.barcode.gateNonce,
                orderId: order.barcode.orderId,
              }),
          }
        : {}),
      status: order.status,
      tierId: order.tierId,
      priceBaht: order.priceBaht,
      createdAt: order.createdAt.toISOString(),
    })),
  );
}

async function markCurrentCustomerPhoneVerified(
  phone: string,
): Promise<VerifiedPhoneClaimResult> {
  const customer = await getOptionalCustomer();
  if (!customer) return "not_applicable";
  const result = await claimVerifiedPhoneForCustomer(customer.id, phone);
  if (result === "verified") {
    revalidatePath("/member/profile");
    revalidatePath("/member");
    revalidatePath("/member/bookings");
  }
  return result;
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
  if (!/^0[689]\d{8}$/.test(phone)) {
    return { error: "กรุณากรอกเบอร์มือถือไทย 10 หลัก เช่น 0929810552" };
  }
  // Consume the per-phone quota atomically before contacting the SMS provider.
  // A COUNT followed by INSERT lets simultaneous requests from many IPs all
  // pass the same check and spam one customer/consume SMS credit.
  const phoneLimit = await rateLimit("booking_search_otp_phone", {
    max: 3,
    windowMs: 15 * 60_000,
    ip: phone,
  });
  if (!phoneLimit.ok) {
    return { error: "ส่งรหัสไปยังเบอร์นี้บ่อยเกินไป กรุณาลองใหม่ภายหลัง" };
  }

  try {
    const { ok, status, data } = await thaiBulkSmsRequest("/v2/otp/request", {
      key: credentials.key,
      secret: credentials.secret,
      msisdn: phone,
    });
    const token = responseValue(data, "token");
    if (!ok || responseValue(data, "status") !== "success" || !token) {
      logOtpProviderFailure(status, data);
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
    UPDATE "BookingSearchOtp"
    SET "attempts" = "attempts" + 1
    WHERE "id" = ${requestId}
      AND "expiresAt" > NOW()
      AND "verifiedAt" IS NULL
      AND "attempts" < 5
    RETURNING "id", "phone", "providerToken", "attempts"
  `;
  const request = requests[0];
  if (!request) return { error: "รหัส OTP หมดอายุหรือกรอกไม่ถูกต้องหลายครั้ง กรุณาส่งรหัสใหม่" };

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
    // ไม่ส่ง OTP เพิ่ม: ถ้าผู้ใช้ล็อกอินอยู่และเบอร์ตรงกับโปรไฟล์
    // ให้ OTP ที่เพิ่งผ่านนี้ยืนยันเบอร์สมาชิกไปพร้อมกัน
    let phoneLinkWarning: string | undefined;
    try {
      const linkResult = await markCurrentCustomerPhoneVerified(request.phone);
      if (linkResult === "conflict") {
        phoneLinkWarning =
          "เบอร์นี้ถูกยืนยันกับบัญชีสมาชิกอื่นแล้ว จึงยังไม่ผูกตั๋วกับบัญชีนี้ กรุณาติดต่อทีมงาน";
      }
    } catch (error) {
      console.error("Failed to mark customer phone as verified", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    const currentCustomer = await getOptionalCustomer();
    const [bookings, seasonPasses] = await Promise.all([
      findBookings(request.phone, currentCustomer?.id ?? null),
      findSeasonPasses(request.phone, currentCustomer?.id ?? null),
    ]);
    await grantBookingRecoveryAccess({
      phone: request.phone,
      customerId: currentCustomer?.id ?? null,
    });
    return {
      verified: true,
      results: { bookings, seasonPasses },
      phoneLinkWarning,
    };
  } catch {
    return { error: "ไม่สามารถยืนยันรหัส OTP ได้ กรุณาลองใหม่" };
  }
}
