import type { Prisma } from "@prisma/client";
import { PAYMENT_EVIDENCE_RETENTION_STATUSES } from "@/lib/payment-state";

// A provider can report a payment a few seconds after its QR deadline even
// when the customer completed payment on time. Keep provider-backed inventory
// briefly so that the signed provider timestamp, not webhook arrival time,
// decides the result.
export const BOOKING_PAYMENT_WEBHOOK_GRACE_MS = 2 * 60 * 1000;

export function bookingProviderGraceCutoff(now = new Date()): Date {
  return new Date(now.getTime() - BOOKING_PAYMENT_WEBHOOK_GRACE_MS);
}

export function bookingProviderGraceEndsAt(paymentExpiresAt: Date): Date {
  return new Date(paymentExpiresAt.getTime() + BOOKING_PAYMENT_WEBHOOK_GRACE_MS);
}

// Shared by automatic cleanup and both capacity-allocation paths. Callers add
// their own match/channel scope while holding the match-capacity advisory lock.
// Keeping payment evidence and the webhook grace in one query prevents a seat
// from being released between an on-time provider payment and its late webhook.
export function cancellablePendingBookingWhere(now: Date): Prisma.BookingWhereInput {
  return {
    status: "PENDING",
    paidAt: null,
    paymentExpiresAt: { lte: now },
    beamPayments: {
      none: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } },
    },
    xenditPayments: {
      none: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } },
    },
    OR: [
      // No provider attempt remains capable of succeeding, so the seat can be
      // released immediately even if failed/expired audit rows are retained.
      {
        beamPayments: { none: { status: { in: ["INITIATED", "PENDING"] } } },
        xenditPayments: { none: { status: "PENDING" } },
      },
      // Provider-backed bookings remain inventory-active during the grace.
      { paymentExpiresAt: { lte: bookingProviderGraceCutoff(now) } },
    ],
  };
}
