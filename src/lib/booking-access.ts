import "server-only";

import { cookies } from "next/headers";
import { getOptionalCustomer } from "@/lib/customer-dal";
import { getMemberTicketIds } from "@/lib/member-tickets";
import {
  createBookingAccessToken,
  verifyBookingAccessToken,
} from "@/lib/booking-access-token";
import {
  bookingAccessClaimHasRequiredSession,
  bookingAccessClaimAllows,
  normalizeBookingAccessPhone,
  type BookingAccessSubject,
} from "@/lib/booking-access-policy";
import {
  BOOKING_ACCESS_COOKIE,
  BOOKING_RECOVERY_ACCESS_COOKIE,
} from "@/lib/booking-access-cookies";

const DIRECT_ACCESS_TTL_SECONDS = 24 * 60 * 60;
const RECOVERY_ACCESS_TTL_SECONDS = 60 * 60;

function accessCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

export async function grantDirectBookingAccess(input: {
  bookingId: string;
  bookingCode: string;
  customerId: string | null;
}): Promise<void> {
  const token = await createBookingAccessToken(
    { kind: "booking-direct", ...input },
    DIRECT_ACCESS_TTL_SECONDS,
  );
  (await cookies()).set(
    BOOKING_ACCESS_COOKIE,
    token,
    accessCookieOptions(DIRECT_ACCESS_TTL_SECONDS),
  );
}

export async function grantBookingRecoveryAccess(input: {
  phone: string;
  customerId: string | null;
}): Promise<void> {
  const token = await createBookingAccessToken(
    {
      kind: "booking-recovery",
      phone: normalizeBookingAccessPhone(input.phone),
      customerId: input.customerId,
    },
    RECOVERY_ACCESS_TTL_SECONDS,
  );
  (await cookies()).set(
    BOOKING_RECOVERY_ACCESS_COOKIE,
    token,
    accessCookieOptions(RECOVERY_ACCESS_TTL_SECONDS),
  );
}

export async function hasBookingAccess(
  booking: BookingAccessSubject & { status?: string },
): Promise<boolean> {
  const cookieStore = await cookies();
  const [directClaim, recoveryClaim, customer] = await Promise.all([
    verifyBookingAccessToken(cookieStore.get(BOOKING_ACCESS_COOKIE)?.value),
    verifyBookingAccessToken(cookieStore.get(BOOKING_RECOVERY_ACCESS_COOKIE)?.value),
    getOptionalCustomer(),
  ]);

  const currentCustomerId = customer?.id ?? null;
  if (
    directClaim &&
    bookingAccessClaimHasRequiredSession(directClaim, currentCustomerId) &&
    bookingAccessClaimAllows(directClaim, booking)
  ) return true;
  if (
    recoveryClaim &&
    bookingAccessClaimHasRequiredSession(recoveryClaim, currentCustomerId) &&
    bookingAccessClaimAllows(recoveryClaim, booking)
  ) return true;
  if (!customer) return false;
  if (booking.customerId === customer.id) return true;

  // Confirmed legacy guest purchases can appear in My Tickets only after the
  // member's unique verified email/phone ownership has been established.
  if (booking.status === "CONFIRMED") {
    const ticketIds = await getMemberTicketIds(customer);
    return ticketIds.bookingIds.includes(booking.id);
  }
  return false;
}
