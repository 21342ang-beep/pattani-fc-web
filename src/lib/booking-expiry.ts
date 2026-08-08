import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BOOKING_RESERVATION_MS = 15 * 60 * 1000;

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
  return prisma.booking.updateMany({
    where: {
      status: "PENDING",
      paymentExpiresAt: { lte: now },
      ...(input.bookingCode ? { bookingCode: input.bookingCode } : {}),
      ...(input.matchIds ? { matchId: { in: input.matchIds } } : {}),
    },
    data: { status: "CANCELLED" },
  });
}
