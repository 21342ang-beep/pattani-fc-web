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
 * Direct grants remain bound to the booking and account. Recovery grants are
 * issued only after a fresh booking-search OTP and cover bookings made with
 * that phone, whether booked as a guest, member or through staff. This does
 * not transfer account ownership or trust an unverified profile phone.
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
  return true;
}
