import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { activateSeasonPassEntitlements } from "@/lib/season-pass-entitlement";
import {
  previewSeasonPassMatchSettlement,
  reverseSeasonPassMatchSettlement,
  settleSeasonPassMatch,
} from "@/lib/season-pass-match-finalization";
import { SEASON_LABEL } from "@/lib/season-pass-tiers";

const prisma = new PrismaClient();
const rollbackMarker = "ROLLBACK_SEASON_PASS_SETTLEMENT_TEST";

after(async () => {
  await prisma.$disconnect();
});

type TestPass = {
  orderId: string;
  barcodeId: string;
  barcode: string;
};

async function createTestPass(
  tx: Prisma.TransactionClient,
  input: {
    suffix: string;
    status: "PENDING" | "CONFIRMED";
    entitlementStartedAt: Date | null;
    usesRemaining: number;
  },
): Promise<TestPass> {
  const token = `${Date.now()}-${input.suffix}`;
  const barcodeValue = `TEST-BARCODE-${token}`;
  const order = await tx.seasonPassOrder.create({
    data: {
      passCode: `TEST-PASS-${token}`,
      tierId: "gold",
      seatZone: "G",
      seasonLabel: SEASON_LABEL,
      priceBaht: 1500,
      customerName: `Test ${input.suffix}`,
      customerPhone: "0800000000",
      deliveryMethod: "PICKUP",
      paymentMethod: "TEST",
      status: input.status,
      salesChannel: "OFFLINE",
      entitlementStartedAt: input.entitlementStartedAt,
    },
    select: { id: true },
  });
  const barcode = await tx.seasonPassBarcode.create({
    data: {
      barcode: barcodeValue,
      tierId: "gold",
      seasonLabel: SEASON_LABEL,
      isGenerated: true,
      usesRemaining: input.usesRemaining,
      orderId: order.id,
      assignedAt: input.entitlementStartedAt ?? new Date("2030-01-01T13:00:00.000Z"),
    },
    select: { id: true },
  });
  return { orderId: order.id, barcodeId: barcode.id, barcode: barcodeValue };
}

test("settlement is atomic, idempotent, preserves scans, handles later buyers, and reverses exactly once", async () => {
  let assertionsCompleted = false;
  try {
    await prisma.$transaction(
      async (tx) => {
        const kickoffAt = new Date("2030-01-01T12:00:00.000Z");
        const settledAt = new Date("2030-01-02T12:00:00.000Z");
        const match = await tx.match.create({
          data: {
            homeTeam: "Pattani FC",
            awayTeam: "Settlement Test FC",
            kickoffAt,
            competitionType: "LEAGUE",
            seasonPassEligible: true,
            status: "FINISHED",
          },
          select: { id: true },
        });

        const scanned = await createTestPass(tx, {
          suffix: "scanned",
          status: "CONFIRMED",
          entitlementStartedAt: new Date("2030-01-01T10:00:00.000Z"),
          usesRemaining: 14,
        });
        const noShow = await createTestPass(tx, {
          suffix: "no-show",
          status: "CONFIRMED",
          entitlementStartedAt: new Date("2030-01-01T10:00:00.000Z"),
          usesRemaining: 15,
        });
        const joinedAfterKickoff = await createTestPass(tx, {
          suffix: "joined-after",
          status: "CONFIRMED",
          entitlementStartedAt: new Date("2030-01-01T13:00:00.000Z"),
          usesRemaining: 15,
        });
        const futureBuyer = await createTestPass(tx, {
          suffix: "future-buyer",
          status: "PENDING",
          entitlementStartedAt: null,
          usesRemaining: 15,
        });
        await tx.seasonPassScan.create({
          data: {
            barcodeId: scanned.barcodeId,
            matchId: match.id,
            scannedAt: new Date("2030-01-01T11:55:00.000Z"),
            scannedBy: "test-gate",
          },
        });

        const before = await previewSeasonPassMatchSettlement(tx, match.id, settledAt);
        assert.equal(before.active, false);
        assert.equal(before.eligible, true);

        const first = await settleSeasonPassMatch(tx, match.id, "test-admin", settledAt);
        assert.equal(first.alreadySettled, false);
        assert.deepEqual(
          await tx.seasonPassBarcode.findMany({
            where: {
              id: { in: [scanned.barcodeId, noShow.barcodeId, joinedAfterKickoff.barcodeId, futureBuyer.barcodeId] },
            },
            orderBy: { barcode: "asc" },
            select: { barcode: true, usesRemaining: true },
          }),
          [
            { barcode: futureBuyer.barcode, usesRemaining: 15 },
            { barcode: joinedAfterKickoff.barcode, usesRemaining: 14 },
            { barcode: noShow.barcode, usesRemaining: 14 },
            { barcode: scanned.barcode, usesRemaining: 14 },
          ].sort((left, right) => left.barcode.localeCompare(right.barcode)),
        );
        assert.equal(
          await tx.seasonPassAbsence.count({
            where: { matchId: match.id, barcodeId: noShow.barcodeId, restoredAt: null },
          }),
          1,
        );
        assert.equal(
          await tx.seasonPassAbsence.count({
            where: {
              matchId: match.id,
              barcodeId: { in: [scanned.barcodeId, joinedAfterKickoff.barcodeId] },
            },
          }),
          0,
        );

        const repeat = await settleSeasonPassMatch(tx, match.id, "test-admin", settledAt);
        assert.equal(repeat.alreadySettled, true);
        assert.equal(
          (await tx.seasonPassBarcode.findUniqueOrThrow({ where: { id: noShow.barcodeId } })).usesRemaining,
          14,
        );

        await tx.seasonPassOrder.update({
          where: { id: futureBuyer.orderId },
          data: { status: "CONFIRMED" },
        });
        const activation = await activateSeasonPassEntitlements(
          tx,
          [futureBuyer.orderId],
          new Date("2030-01-03T12:00:00.000Z"),
        );
        assert.equal(activation.initialUses, 14);
        assert.equal(
          (await tx.seasonPassBarcode.findUniqueOrThrow({ where: { id: futureBuyer.barcodeId } })).usesRemaining,
          14,
        );
        assert.equal(
          await tx.seasonPassAbsence.count({
            where: { matchId: match.id, barcodeId: futureBuyer.barcodeId },
          }),
          0,
        );

        const restored = await reverseSeasonPassMatchSettlement(
          tx,
          match.id,
          "test-admin",
          new Date("2030-01-04T12:00:00.000Z"),
        );
        assert.ok(restored.restoredAbsences >= 1);
        assert.ok(restored.restoredLaterBuyers >= 2);
        assert.equal(
          (await tx.seasonPassBarcode.findUniqueOrThrow({ where: { id: scanned.barcodeId } })).usesRemaining,
          14,
        );
        for (const barcodeId of [noShow.barcodeId, joinedAfterKickoff.barcodeId, futureBuyer.barcodeId]) {
          assert.equal(
            (await tx.seasonPassBarcode.findUniqueOrThrow({ where: { id: barcodeId } })).usesRemaining,
            15,
          );
        }
        assert.equal(
          await tx.seasonPassAbsence.count({
            where: { matchId: match.id, barcodeId: noShow.barcodeId, restoredAt: { not: null } },
          }),
          1,
        );

        await settleSeasonPassMatch(
          tx,
          match.id,
          "test-admin",
          new Date("2030-01-05T12:00:00.000Z"),
        );
        assert.equal(
          (await tx.seasonPassBarcode.findUniqueOrThrow({ where: { id: scanned.barcodeId } })).usesRemaining,
          14,
        );
        for (const barcodeId of [noShow.barcodeId, joinedAfterKickoff.barcodeId, futureBuyer.barcodeId]) {
          assert.equal(
            (await tx.seasonPassBarcode.findUniqueOrThrow({ where: { id: barcodeId } })).usesRemaining,
            14,
          );
        }

        assertionsCompleted = true;
        throw new Error(rollbackMarker);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 },
    );
    assert.fail("test transaction should have rolled back");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
  }
  assert.equal(assertionsCompleted, true);
});
