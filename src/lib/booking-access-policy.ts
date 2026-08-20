export type BookingAccessClaim =
  | {
      kind: "booking-direct";
      bookingId: string;
      bookingCode: string;
      customerId: string | null;
    }
  | {
      kind: "booking-recovery";
      phone: string;
      customerId: string | null;
    };

export type BookingAccessSubject = {
  id: string;
  bookingCode: string;
  customerId: string | null;
  customerPhone: string;
};

export function bookingAccessClaimHasRequiredSession(
  claim: BookingAccessClaim,
  currentCustomerId: string | null,
): boolean {
  return claim.customerId === null || claim.customerId === currentCustomerId;
}

export function normalizeBookingAccessPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0066") && digits.length === 13) return `0${digits.slice(4)}`;
  if (digits.startsWith("66") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}

/**
 * Pure ownership policy shared by pages and payment routes. A recovery grant
 * proves control of a phone number, but a guest grant can never cross into a
 * member-owned row. A signed-in recovery grant may access guest rows with the
 * verified phone plus rows already bound to that same member.
 */
export function bookingAccessClaimAllows(
  claim: BookingAccessClaim,
  booking: BookingAccessSubject,
): boolean {
  if (claim.kind === "booking-direct") {
    return (
      claim.bookingId === booking.id &&
      claim.bookingCode === booking.bookingCode &&
      claim.customerId === booking.customerId
    );
  }

  if (
    normalizeBookingAccessPhone(claim.phone) !==
    normalizeBookingAccessPhone(booking.customerPhone)
  ) {
    return false;
  }
  if (booking.customerId === null) return true;
  return claim.customerId !== null && claim.customerId === booking.customerId;
}
