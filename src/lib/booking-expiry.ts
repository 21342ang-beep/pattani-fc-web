import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BOOKING_RESERVATION_MS = 5 * 60 * 1000;

// Keep expired online bookings that reached a payment provider for a short
// reconciliation window. They are hidden from the admin list immediately,
// but retaining them lets a delayed, valid webhook confirm an on-time payment.
export const BOOKING_PAYMENT_RECONCILIATION_MS = 24 * 60 * 60 * 1000;

export function newBookingPaymentDeadline(now = new Date()) {
  return new Date(now.getTime() + BOOKING_RESERVATION_MS);
}

export function activeBookingStatusWhere(now = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: "CONFIRMED" },
      { status: "PENDING", paymentExpiresAt: { gt: now } },
    ],
  };
}

export async function expirePendingBookings(input: {
  bookingCode?: string;
  matchIds?: string[];
  now?: Date;
} = {}) {
  const now = input.now ?? new Date();
  const target = {
    ...(input.bookingCode ? { bookingCode: input.bookingCode } : {}),
    ...(input.matchIds ? { matchId: { in: input.matchIds } } : {}),
  };

  return prisma.$transaction(async (tx) => {
    const expired = await tx.booking.updateMany({
      where: {
        status: "PENDING",
        salesChannel: "ONLINE",
        paymentExpiresAt: { lte: now },
        paidAt: null,
        beamPayments: { none: { status: "SUCCEEDED" } },
        xenditPayments: { none: { status: "SUCCEEDED" } },
        ...target,
      },
      data: { status: "CANCELLED" },
    });

    // A reservation that never reached a provider is safe to remove as soon
    // as it expires. Provider-backed attempts get a reconciliation window so
    // a delayed payment webhook cannot lose a customer's paid booking.
    await tx.booking.deleteMany({
      where: {
        status: "CANCELLED",
        salesChannel: "ONLINE",
        paidAt: null,
        paymentExpiresAt: { lte: now },
        beamPayments: { none: {} },
        xenditPayments: { none: {} },
        ...target,
      },
    });
    await tx.booking.deleteMany({
      where: {
        status: "CANCELLED",
        salesChannel: "ONLINE",
        paidAt: null,
        paymentExpiresAt: {
          lte: new Date(now.getTime() - BOOKING_PAYMENT_RECONCILIATION_MS),
        },
        beamPayments: { none: { status: "SUCCEEDED" } },
        xenditPayments: { none: { status: "SUCCEEDED" } },
        ...target,
      },
    });

    return expired;
  });
}
