import "server-only";

import { Prisma } from "@prisma/client";
import { calculateSeasonPassInitialUses } from "@/lib/season-pass-entitlement-policy";
import { SEASON_LABEL, SEASON_MATCHES } from "@/lib/season-pass-tiers";

type TransactionClient = Prisma.TransactionClient;

export async function countSettledSeasonPassMatches(
  db: TransactionClient,
  input: { seasonLabel: string; beforeOrAt: Date },
): Promise<number> {
  const rows = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "SeasonPassMatchFinalization" AS finalization
    INNER JOIN "Match" AS match ON match."id" = finalization."matchId"
    WHERE finalization."seasonLabel" = ${input.seasonLabel}
      AND finalization."reversedAt" IS NULL
      AND match."kickoffAt" IS NOT NULL
      AND match."kickoffAt" <= ${input.beforeOrAt}
  `);
  return rows[0]?.count ?? 0;
}

export async function getCurrentSeasonPassInitialUses(
  db: TransactionClient,
  now = new Date(),
): Promise<number> {
  const settled = await countSettledSeasonPassMatches(db, {
    seasonLabel: SEASON_LABEL,
    beforeOrAt: now,
  });
  return calculateSeasonPassInitialUses(SEASON_MATCHES, settled);
}

/**
 * Activates newly confirmed orders once. Pending orders may reserve a barcode,
 * but their season entitlement starts only when payment/status is confirmed.
 */
export async function activateSeasonPassEntitlements(
  tx: TransactionClient,
  orderIds: readonly string[],
  startedAt: Date,
): Promise<{ activated: number; initialUses: number }> {
  const ids = [...new Set(orderIds)].sort();
  if (ids.length === 0) return { activated: 0, initialUses: SEASON_MATCHES };

  await tx.$queryRaw(Prisma.sql`
    SELECT barcode."id"
    FROM "SeasonPassBarcode" AS barcode
    WHERE barcode."orderId" IN (${Prisma.join(ids)})
    ORDER BY barcode."id"
    FOR UPDATE
  `);

  const orders = await tx.seasonPassOrder.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      seasonLabel: true,
      entitlementStartedAt: true,
      barcode: {
        select: {
          id: true,
          usesRemaining: true,
          _count: { select: { scans: true, absences: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });
  if (orders.length !== ids.length) throw new Error("SEASON_ENTITLEMENT_ORDER_MISSING");
  if (orders.some((order) => order.status !== "CONFIRMED")) {
    throw new Error("SEASON_ENTITLEMENT_ORDER_NOT_CONFIRMED");
  }

  const pendingActivation = orders.filter((order) => order.entitlementStartedAt == null);
  if (pendingActivation.length === 0) {
    return {
      activated: 0,
      initialUses: orders[0]?.barcode?.usesRemaining ?? SEASON_MATCHES,
    };
  }
  if (pendingActivation.some((order) => !order.barcode)) {
    throw new Error("SEASON_ENTITLEMENT_BARCODE_MISSING");
  }
  if (pendingActivation.some((order) =>
    order.barcode!._count.scans !== 0 || order.barcode!._count.absences !== 0
  )) {
    throw new Error("SEASON_ENTITLEMENT_HISTORY_EXISTS");
  }

  const seasonLabels = [...new Set(pendingActivation.map((order) => order.seasonLabel))];
  if (seasonLabels.length !== 1) throw new Error("SEASON_ENTITLEMENT_MIXED_SEASONS");
  const settled = await countSettledSeasonPassMatches(tx, {
    seasonLabel: seasonLabels[0],
    beforeOrAt: startedAt,
  });
  const initialUses = calculateSeasonPassInitialUses(SEASON_MATCHES, settled);

  const orderUpdate = await tx.seasonPassOrder.updateMany({
    where: {
      id: { in: pendingActivation.map((order) => order.id) },
      status: "CONFIRMED",
      entitlementStartedAt: null,
    },
    data: { entitlementStartedAt: startedAt },
  });
  if (orderUpdate.count !== pendingActivation.length) {
    throw new Error("SEASON_ENTITLEMENT_ORDER_CHANGED");
  }

  const barcodeUpdate = await tx.seasonPassBarcode.updateMany({
    where: {
      id: { in: pendingActivation.map((order) => order.barcode!.id) },
      orderId: { in: pendingActivation.map((order) => order.id) },
    },
    data: { usesRemaining: initialUses },
  });
  if (barcodeUpdate.count !== pendingActivation.length) {
    throw new Error("SEASON_ENTITLEMENT_BARCODE_CHANGED");
  }

  return { activated: pendingActivation.length, initialUses };
}
