import "server-only";

import { Prisma } from "@prisma/client";
import { PAYMENT_EVIDENCE_RETENTION_STATUSES } from "@/lib/payment-state";
import { prisma } from "@/lib/prisma";
import {
  bookingProviderGraceCutoff,
  cancellablePendingBookingWhere,
} from "@/lib/booking-expiry-policy";

export const BOOKING_RESERVATION_MS = 5 * 60 * 1000;

// Keep expired online bookings that reached a payment provider for a short
// reconciliation window. Successful or review-required payment evidence is
// retained indefinitely; other provider attempts may be cleaned after this
// window once their QR can no longer be paid.
export const BOOKING_PAYMENT_RECONCILIATION_MS = 24 * 60 * 60 * 1000;

export function newBookingPaymentDeadline(now = new Date()) {
  return new Date(now.getTime() + BOOKING_RESERVATION_MS);
}

export function activeBookingStatusWhere(now = new Date()): Prisma.BookingWhereInput {
  const providerGraceCutoff = bookingProviderGraceCutoff(now);
  return {
    OR: [
      { status: "CONFIRMED" },
      { status: "PENDING", paymentExpiresAt: { gt: now } },
      {
        status: "PENDING",
        OR: [
          {
            beamPayments: {
              some: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } },
            },
          },
          {
            xenditPayments: {
              some: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } },
            },
          },
          {
            paymentExpiresAt: { gt: providerGraceCutoff },
            OR: [
              { beamPayments: { some: { status: { in: ["INITIATED", "PENDING"] } } } },
              { xenditPayments: { some: { status: "PENDING" } } },
            ],
          },
        ],
      },
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
    const reconciliationCutoff = new Date(
      now.getTime() - BOOKING_PAYMENT_RECONCILIATION_MS,
    );
    const matchIds = (await tx.booking.findMany({
      where: {
        ...target,
        salesChannel: "ONLINE",
        paidAt: null,
        OR: [
          {
            ...cancellablePendingBookingWhere(now),
          },
          {
            status: "CANCELLED",
            paymentExpiresAt: { lte: now },
            beamPayments: { none: {} },
            xenditPayments: { none: {} },
          },
          {
            status: "CANCELLED",
            paymentExpiresAt: { lte: reconciliationCutoff },
            beamPayments: {
              none: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } },
            },
            xenditPayments: {
              none: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } },
            },
          },
        ],
      },
      distinct: ["matchId"],
      select: { matchId: true },
    })).map((booking) => booking.matchId);
    // Use the same ordered advisory locks as booking creation and payment
    // confirmation. This prevents cleanup from deleting a payment row while a
    // signed provider webhook is moving it to SUCCEEDED/REVIEW_REQUIRED.
    for (const matchId of matchIds.sort()) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`match-capacity:${matchId}`}))`,
      );
    }

    const expired = await tx.booking.updateMany({
      where: {
        ...cancellablePendingBookingWhere(now),
        salesChannel: "ONLINE",
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
          lte: reconciliationCutoff,
        },
        beamPayments: { none: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } } },
        xenditPayments: { none: { status: { in: [...PAYMENT_EVIDENCE_RETENTION_STATUSES] } } },
        ...target,
      },
    });

    return expired;
  });
}
