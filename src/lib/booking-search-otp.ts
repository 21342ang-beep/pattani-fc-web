import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const BOOKING_SEARCH_OTP_COOKIE = "booking_search_otp";

export function normalizeBookingSearchPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function getVerifiedBookingSearchOtp(phone: string) {
  const cookieStore = await cookies();
  const otpId = cookieStore.get(BOOKING_SEARCH_OTP_COOKIE)?.value;
  if (!otpId) return null;

  return prisma.bookingSearchOtp.findFirst({
    where: {
      id: otpId,
      phone: normalizeBookingSearchPhone(phone),
      verifiedAt: { not: null },
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
}
