import "server-only";

import { Prisma } from "@prisma/client";
import {
  getStadiumZone,
  getZoneCapacity,
  getZoneCapacityScope,
  type StadiumZoneCode,
} from "@/lib/stadium-zones";
import { isStandaloneSeasonOrder } from "@/lib/season-payment-invariants";
import { activeBookingStatusWhere } from "@/lib/booking-expiry";

export type StoredPaymentTarget = {
  bookingId: string | null;
  seasonPassOrderId: string | null;
  seasonPassPurchaseId: string | null;
  amount: number;
  referenceId: string;
};

export type PaymentTargetReference =
  | { kind: "booking"; code: string }
  | { kind: "season"; code: string };

export type PaymentTargetConfirmation =
  | {
      outcome: "CONFIRMED";
      kind: "booking" | "season";
      code: string;
      matchId?: string;
    }
  | {
      outcome: "REVIEW_REQUIRED";
      reason: string;
      kind?: "booking" | "season";
      code?: string;
    };

export async function acquirePaymentTargetLock(
  tx: Prisma.TransactionClient,
  target: StoredPaymentTarget,
): Promise<void> {
  if (target.bookingId) {
    const booking = await tx.booking.findUnique({
      where: { id: target.bookingId },
      select: { matchId: true },
    });
    const lockKey = booking
      ? `match-capacity:${booking.matchId}`
      : `missing-booking-payment-target:${target.bookingId}`;
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`,
    );
    return;
  }

  if (target.seasonPassPurchaseId) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`season-purchase:${target.seasonPassPurchaseId}`}))`,
    );
    return;
  }

  if (target.seasonPassOrderId) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`season-order:${target.seasonPassOrderId}`}))`,
    );
  }
}

export async function confirmStoredPaymentTarget(
  tx: Prisma.TransactionClient,
  target: StoredPaymentTarget,
  input: {
    reference: PaymentTargetReference;
    paidAt: Date;
    paymentMethod: string;
  },
): Promise<PaymentTargetConfirmation> {
  if (target.bookingId) {
    return confirmBookingPayment(tx, { ...target, bookingId: target.bookingId }, input);
  }
  if (target.seasonPassPurchaseId) {
    return confirmSeasonPassPurchasePayment(
      tx,
      { ...target, seasonPassPurchaseId: target.seasonPassPurchaseId },
      input,
    );
  }
  if (target.seasonPassOrderId) {
    return confirmStandaloneSeasonPassPayment(
      tx,
      { ...target, seasonPassOrderId: target.seasonPassOrderId },
      input,
    );
  }
  return { outcome: "REVIEW_REQUIRED", reason: "payment_target_missing" };
}

async function confirmBookingPayment(
  tx: Prisma.TransactionClient,
  target: StoredPaymentTarget & { bookingId: string },
  input: {
    reference: PaymentTargetReference;
    paidAt: Date;
    paymentMethod: string;
  },
): Promise<PaymentTargetConfirmation> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${target.bookingId} FOR UPDATE`,
  );
  const booking = await tx.booking.findUnique({
    where: { id: target.bookingId },
    include: { match: { include: { ticketZones: true } } },
  });
  if (!booking) return { outcome: "REVIEW_REQUIRED", reason: "booking_not_found" };
  if (input.reference.kind !== "booking" || input.reference.code !== booking.bookingCode) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_reference_mismatch" };
  }
  const base = { kind: "booking" as const, code: booking.bookingCode };
  if (booking.status !== "PENDING") {
    return {
      outcome: "REVIEW_REQUIRED",
      reason: booking.status === "CANCELLED" ? "booking_cancelled" : "booking_not_pending",
      ...base,
    };
  }
  if (booking.salesChannel !== "ONLINE" || booking.paidAt) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_not_online_unpaid", ...base };
  }
  if (booking.totalAmount !== target.amount) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_amount_mismatch", ...base };
  }
  if (!booking.paymentExpiresAt) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_deadline_missing", ...base };
  }
  if (input.paidAt > booking.paymentExpiresAt) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_payment_late", ...base };
  }
  if (!booking.zone) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_zone_missing", ...base };
  }

  const dynamicZone = booking.match.ticketZones.find((zone) => zone.code === booking.zone);
  const legacyZone = getStadiumZone(booking.zone);
  if (!dynamicZone && !legacyZone) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_zone_unknown", ...base };
  }
  const capacity = dynamicZone?.capacity ?? (legacyZone
    ? getZoneCapacity(booking.match, booking.zone as StadiumZoneCode)
    : null);
  if (capacity == null || capacity < 0) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_capacity_missing", ...base };
  }
  const capacityScope = dynamicZone
    ? [dynamicZone.code]
    : getZoneCapacityScope(booking.match, booking.zone as StadiumZoneCode);
  const now = new Date();
  const occupied = await tx.booking.aggregate({
    where: {
      id: { not: booking.id },
      matchId: booking.matchId,
      zone: { in: capacityScope },
      ...activeBookingStatusWhere(now),
    },
    _sum: { quantity: true },
  });
  if ((occupied._sum.quantity ?? 0) + booking.quantity > capacity) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_capacity_unsafe", ...base };
  }

  const updated = await tx.booking.updateMany({
    where: {
      id: booking.id,
      status: "PENDING",
      salesChannel: "ONLINE",
      paidAt: null,
      totalAmount: target.amount,
      paymentExpiresAt: { gte: input.paidAt },
    },
    data: {
      status: "CONFIRMED",
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt,
      paymentExpiresAt: null,
    },
  });
  if (updated.count !== 1) {
    return { outcome: "REVIEW_REQUIRED", reason: "booking_changed_during_confirmation", ...base };
  }
  return { outcome: "CONFIRMED", ...base, matchId: booking.matchId };
}

async function confirmSeasonPassPurchasePayment(
  tx: Prisma.TransactionClient,
  target: StoredPaymentTarget & { seasonPassPurchaseId: string },
  input: {
    reference: PaymentTargetReference;
    paidAt: Date;
    paymentMethod: string;
  },
): Promise<PaymentTargetConfirmation> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "SeasonPassPurchase" WHERE "id" = ${target.seasonPassPurchaseId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "SeasonPassOrder" WHERE "purchaseId" = ${target.seasonPassPurchaseId} FOR UPDATE`,
  );
  const purchase = await tx.seasonPassPurchase.findUnique({
    where: { id: target.seasonPassPurchaseId },
    include: {
      orders: {
        select: { id: true, status: true, salesChannel: true },
      },
    },
  });
  if (!purchase) return { outcome: "REVIEW_REQUIRED", reason: "season_purchase_not_found" };
  if (input.reference.kind !== "season" || input.reference.code !== purchase.purchaseCode) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_purchase_reference_mismatch" };
  }
  const base = { kind: "season" as const, code: purchase.purchaseCode };
  if (purchase.status !== "PENDING") {
    return {
      outcome: "REVIEW_REQUIRED",
      reason: purchase.status === "CANCELLED" ? "season_purchase_cancelled" : "season_purchase_not_pending",
      ...base,
    };
  }
  if (purchase.totalBaht * 100 !== target.amount) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_purchase_amount_mismatch", ...base };
  }
  if (purchase.paymentExpiresAt && input.paidAt > purchase.paymentExpiresAt) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_purchase_payment_late", ...base };
  }
  if (
    purchase.orders.length !== purchase.quantity ||
    purchase.orders.some((order) => order.status !== "PENDING" || order.salesChannel !== "ONLINE")
  ) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_purchase_orders_inconsistent", ...base };
  }

  const updatedPurchase = await tx.seasonPassPurchase.updateMany({
    where: {
      id: purchase.id,
      status: "PENDING",
      ...(purchase.paymentExpiresAt
        ? { paymentExpiresAt: { gte: input.paidAt } }
        : {}),
    },
    data: { status: "CONFIRMED", paymentMethod: input.paymentMethod },
  });
  if (updatedPurchase.count !== 1) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_purchase_changed_during_confirmation", ...base };
  }
  const updatedOrders = await tx.seasonPassOrder.updateMany({
    where: {
      id: { in: purchase.orders.map((order) => order.id) },
      status: "PENDING",
      salesChannel: "ONLINE",
    },
    data: { status: "CONFIRMED", paymentMethod: input.paymentMethod },
  });
  if (updatedOrders.count !== purchase.orders.length) {
    throw new Error("SEASON_PURCHASE_ORDERS_CHANGED");
  }
  return { outcome: "CONFIRMED", ...base };
}

async function confirmStandaloneSeasonPassPayment(
  tx: Prisma.TransactionClient,
  target: StoredPaymentTarget & { seasonPassOrderId: string },
  input: {
    reference: PaymentTargetReference;
    paidAt: Date;
    paymentMethod: string;
  },
): Promise<PaymentTargetConfirmation> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "SeasonPassOrder" WHERE "id" = ${target.seasonPassOrderId} FOR UPDATE`,
  );
  const order = await tx.seasonPassOrder.findUnique({
    where: { id: target.seasonPassOrderId },
  });
  if (!order) return { outcome: "REVIEW_REQUIRED", reason: "season_order_not_found" };
  if (!isStandaloneSeasonOrder(order)) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_order_belongs_to_purchase" };
  }
  if (input.reference.kind !== "season" || input.reference.code !== order.passCode) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_order_reference_mismatch" };
  }
  const base = { kind: "season" as const, code: order.passCode };
  if (order.status !== "PENDING" || order.salesChannel !== "ONLINE") {
    return {
      outcome: "REVIEW_REQUIRED",
      reason: order.status === "CANCELLED" ? "season_order_cancelled" : "season_order_not_pending",
      ...base,
    };
  }
  if ((order.priceBaht + order.shippingFeeBaht) * 100 !== target.amount) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_order_amount_mismatch", ...base };
  }
  const updated = await tx.seasonPassOrder.updateMany({
    where: {
      id: order.id,
      purchaseId: null,
      status: "PENDING",
      salesChannel: "ONLINE",
    },
    data: { status: "CONFIRMED", paymentMethod: input.paymentMethod },
  });
  if (updated.count !== 1) {
    return { outcome: "REVIEW_REQUIRED", reason: "season_order_changed_during_confirmation", ...base };
  }
  return { outcome: "CONFIRMED", ...base };
}
