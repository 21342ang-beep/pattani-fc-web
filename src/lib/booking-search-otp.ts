import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const BOOKING_SEARCH_OTP_COOKIE = "booking_search_otp";

export function normalizeBookingSearchPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0066") && digits.length === 13) return `0${digits.slice(4)}`;
  if (digits.startsWith("66") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}

export function bookingSearchPhoneVariants(phone: string): string[] {
  const domestic = normalizeBookingSearchPhone(phone);
  if (/^0\d{9}$/.test(domestic)) return [domestic, `66${domestic.slice(1)}`];
  return [domestic, domestic];
}

export async function getVerifiedBookingSearchOtp(phone: string) {
  const cookieStore = await cookies();
  const otpId = cookieStore.get(BOOKING_SEARCH_OTP_COOKIE)?.value;
  if (!otpId) return null;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "BookingSearchOtp"
    WHERE "id" = ${otpId}
      AND "phone" = ${normalizeBookingSearchPhone(phone)}
      AND "verifiedAt" IS NOT NULL
      AND "expiresAt" > NOW()
    LIMIT 1
  `;
  return rows[0] ?? null;
}
