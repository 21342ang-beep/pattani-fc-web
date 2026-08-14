import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SEASON_PASS_RESERVATION_MS = 15 * 60 * 1000;

export function newSeasonPassPaymentDeadline(now = new Date()) {
  return new Date(now.getTime() + SEASON_PASS_RESERVATION_MS);
}

/**
 * Active inventory includes confirmed orders, staff pending orders, and online
 * pending orders whose cleanup has not completed yet.
 */
export function activeSeasonPassOrderWhere(now = new Date()): Prisma.SeasonPassOrderWhereInput {
  return {
    OR: [
      { status: "CONFIRMED" },
      { status: "PENDING", salesChannel: { not: "ONLINE" } },
      { status: "PENDING", salesChannel: "ONLINE", purchaseId: null },
      {
        status: "PENDING",
        salesChannel: "ONLINE",
        purchase: {
          is: {
            OR: [
              { paymentExpiresAt: null },
              { paymentExpiresAt: { gt: now } },
            ],
          },
        },
      },
    ],
  };
}

export async function expirePendingSeasonPassPurchases(input: {
  purchaseCode?: string;
  passCode?: string;
  now?: Date;
} = {}) {
  const now = input.now ?? new Date();
  const targetWhere: Prisma.SeasonPassPurchaseWhereInput = input.purchaseCode && input.passCode
    ? {
        OR: [
          { purchaseCode: input.purchaseCode },
          { orders: { some: { passCode: input.passCode } } },
        ],
      }
    : input.purchaseCode
      ? { purchaseCode: input.purchaseCode }
      : input.passCode
        ? { orders: { some: { passCode: input.passCode } } }
        : {};
  const expired = await prisma.seasonPassPurchase.findMany({
    where: {
      status: "PENDING",
      orders: {
        some: { status: "PENDING", salesChannel: "ONLINE" },
        none: {
          OR: [
            { beamPayments: { some: { status: "SUCCEEDED" } } },
            { xenditPayments: { some: { status: "SUCCEEDED" } } },
          ],
        },
      },
      OR: [
        { paymentExpiresAt: null },
        { paymentExpiresAt: { lte: now } },
      ],
      beamPayments: { none: { status: "SUCCEEDED" } },
      xenditPayments: { none: { status: "SUCCEEDED" } },
      ...targetWhere,
    },
    select: { id: true },
  });

  let cancelled = 0;
  for (const purchase of expired) {
    cancelled += await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-purchase:${purchase.id}`}))`;
      const claimed = await tx.seasonPassPurchase.updateMany({
        where: {
          id: purchase.id,
          status: "PENDING",
          orders: {
            some: { status: "PENDING", salesChannel: "ONLINE" },
            none: {
              OR: [
                { beamPayments: { some: { status: "SUCCEEDED" } } },
                { xenditPayments: { some: { status: "SUCCEEDED" } } },
              ],
            },
          },
          OR: [
            { paymentExpiresAt: null },
            { paymentExpiresAt: { lte: now } },
          ],
          // Re-check payment evidence after acquiring the same purchase lock
          // used by the webhook. Paid customers must never be cancelled.
          beamPayments: { none: { status: "SUCCEEDED" } },
          xenditPayments: { none: { status: "SUCCEEDED" } },
        },
        data: { status: "CANCELLED" },
      });
      if (claimed.count === 0) return 0;

      const orders = await tx.seasonPassOrder.findMany({
        where: { purchaseId: purchase.id, status: "PENDING", salesChannel: "ONLINE" },
        select: { id: true, passCode: true },
      });
      for (const order of orders) {
        // Free the unique barcode for the next customer while retaining the
        // cancelled order as an audit record under a non-ticket code.
        await tx.seasonPassOrder.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            passCode: `EXPIRED-${order.id}-${order.passCode}`,
          },
        });
        await tx.seasonPassBarcode.updateMany({
          where: { orderId: order.id },
          data: { orderId: null, assignedAt: null },
        });
      }
      await tx.beamPayment.updateMany({
        where: {
          seasonPassPurchaseId: purchase.id,
          status: { in: ["INITIATED", "PENDING"] },
        },
        data: { status: "EXPIRED" },
      });
      await tx.xenditPayment.updateMany({
        where: {
          seasonPassPurchaseId: purchase.id,
          status: { in: ["INITIATED", "PENDING"] },
        },
        data: { status: "EXPIRED" },
      });
      return 1;
    });
  }

  // Backward compatibility for very old online orders that predate the
  // SeasonPassPurchase grouping model.
  const standalone = input.purchaseCode && !input.passCode
    ? []
    : await prisma.seasonPassOrder.findMany({
    where: {
      status: "PENDING",
      salesChannel: "ONLINE",
      purchaseId: null,
      ...(input.passCode ? { passCode: input.passCode } : {}),
      beamPayments: { none: { status: "SUCCEEDED" } },
      xenditPayments: { none: { status: "SUCCEEDED" } },
    },
    select: { id: true },
      });
  for (const candidate of standalone) {
    cancelled += await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-order:${candidate.id}`}))`;
      const order = await tx.seasonPassOrder.findFirst({
        where: {
          id: candidate.id,
          status: "PENDING",
          salesChannel: "ONLINE",
          purchaseId: null,
          beamPayments: { none: { status: "SUCCEEDED" } },
          xenditPayments: { none: { status: "SUCCEEDED" } },
        },
        select: { id: true, passCode: true },
      });
      if (!order) return 0;
      await tx.seasonPassOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED", passCode: `EXPIRED-${order.id}-${order.passCode}` },
      });
      await tx.seasonPassBarcode.updateMany({
        where: { orderId: order.id },
        data: { orderId: null, assignedAt: null },
      });
      await tx.beamPayment.updateMany({
        where: { seasonPassOrderId: order.id, status: { in: ["INITIATED", "PENDING"] } },
        data: { status: "EXPIRED" },
      });
      await tx.xenditPayment.updateMany({
        where: { seasonPassOrderId: order.id, status: { in: ["INITIATED", "PENDING"] } },
        data: { status: "EXPIRED" },
      });
      return 1;
    });
  }
  return { count: cancelled };
}
