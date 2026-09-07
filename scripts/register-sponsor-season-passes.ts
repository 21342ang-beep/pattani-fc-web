import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  SPONSOR_SEASON_PASS_ENTRIES,
  SPONSOR_SEASON_PASS_IMPORT_VERSION,
  sponsorSeasonPassAuditMarker,
  type SponsorSeasonPassEntry,
} from "../src/lib/sponsor-season-pass-manifest";
import { SEASON_LABEL, SEASON_MATCHES, SEASON_TIERS } from "../src/lib/season-pass-tiers";
import { calculateSeasonPassZoneRanges } from "../src/lib/season-pass-zone-ranges";
import { calculateSeasonPassInitialUses } from "../src/lib/season-pass-entitlement-policy";

type BarcodeRow = Awaited<ReturnType<typeof readTargetBarcodes>>[number];

const apply = process.argv.includes("--apply");
const unexpectedArgs = process.argv.slice(2).filter((arg) => arg !== "--apply");

function fail(message: string): never {
  throw new Error(message);
}

function assertManifest() {
  if (SPONSOR_SEASON_PASS_ENTRIES.length !== 91) {
    fail(`Manifest must contain exactly 91 issued cards; found ${SPONSOR_SEASON_PASS_ENTRIES.length}`);
  }
  const uniqueBarcodes = new Set(SPONSOR_SEASON_PASS_ENTRIES.map((entry) => entry.barcode));
  if (uniqueBarcodes.size !== SPONSOR_SEASON_PASS_ENTRIES.length) {
    fail("Manifest contains duplicate issued barcodes");
  }
  if (SPONSOR_SEASON_PASS_ENTRIES.some((entry) => /^PFC26-2500-014[1-3]$/.test(entry.barcode))) {
    fail("Manifest must never include customer VIP-A cards 0141-0143");
  }
  const unavailableVipCards = new Set([
    "PFC26-2500-0190",
    "PFC26-2500-0191",
    "PFC26-2500-0192",
    "PFC26-2500-0193",
  ]);
  if (SPONSOR_SEASON_PASS_ENTRIES.some((entry) => unavailableVipCards.has(entry.barcode))) {
    fail("Manifest contains a held or lost VIP-A card that must remain unregistered");
  }
}

async function readTargetBarcodes(tx: Prisma.TransactionClient) {
  return tx.seasonPassBarcode.findMany({
    where: {
      barcode: { in: SPONSOR_SEASON_PASS_ENTRIES.map((entry) => entry.barcode) },
    },
    select: {
      id: true,
      barcode: true,
      tierId: true,
      seasonLabel: true,
      isGenerated: true,
      usesRemaining: true,
      legacyGateAllowed: true,
      orderId: true,
      _count: { select: { scans: true } },
      order: {
        select: {
          id: true,
          passCode: true,
          tierId: true,
          seatZone: true,
          seasonLabel: true,
          priceBaht: true,
          shippingFeeBaht: true,
          customerId: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          deliveryMethod: true,
          pickupLocation: true,
          paymentMethod: true,
          status: true,
          salesChannel: true,
          notes: true,
        },
      },
    },
    orderBy: { barcode: "asc" },
  });
}

function matchingSponsorOrder(entry: SponsorSeasonPassEntry, row: BarcodeRow) {
  const order = row.order;
  return Boolean(
    order &&
      order.passCode === entry.barcode &&
      order.tierId === entry.tierId &&
      order.seatZone === entry.seatZone &&
      order.seasonLabel === SEASON_LABEL &&
      order.priceBaht === 0 &&
      order.shippingFeeBaht === 0 &&
      order.customerId === null &&
      order.customerName === entry.sponsorName &&
      order.customerPhone === "" &&
      order.customerEmail === null &&
      order.deliveryMethod === "PICKUP" &&
      order.pickupLocation === "สโมสร" &&
      order.paymentMethod === "SPONSOR" &&
      order.status === "CONFIRMED" &&
      order.salesChannel === "INTERNAL" &&
      order.notes === sponsorSeasonPassAuditMarker(entry),
  );
}

async function inspect(tx: Prisma.TransactionClient) {
  const entriesByBarcode = new Map(
    SPONSOR_SEASON_PASS_ENTRIES.map((entry) => [entry.barcode, entry]),
  );
  const rows = await readTargetBarcodes(tx);
  const rowsByBarcode = new Map(rows.map((row) => [row.barcode, row]));
  const issues: string[] = [];
  const alreadyRegistered: SponsorSeasonPassEntry[] = [];
  const wouldCreate: SponsorSeasonPassEntry[] = [];

  for (const entry of SPONSOR_SEASON_PASS_ENTRIES) {
    const row = rowsByBarcode.get(entry.barcode);
    if (!row) {
      issues.push(`${entry.barcode}: barcode row is missing`);
      continue;
    }
    if (row.tierId !== entry.tierId || row.seasonLabel !== SEASON_LABEL || !row.isGenerated) {
      issues.push(`${entry.barcode}: barcode metadata does not match the manifest`);
      continue;
    }
    if (row.order) {
      if (!matchingSponsorOrder(entry, row)) {
        issues.push(`${entry.barcode}: already belongs to a different order`);
      } else if (!row.legacyGateAllowed) {
        issues.push(`${entry.barcode}: physical-card scanning is disabled`);
      } else {
        alreadyRegistered.push(entry);
      }
      continue;
    }
    if (row._count.scans !== 0) {
      issues.push(`${entry.barcode}: unassigned barcode has scan history`);
      continue;
    }
    wouldCreate.push(entry);
  }

  const passCodeOrders = await tx.seasonPassOrder.findMany({
    where: { passCode: { in: [...entriesByBarcode.keys()] } },
    select: { id: true, passCode: true },
  });
  for (const order of passCodeOrders) {
    const row = rowsByBarcode.get(order.passCode);
    if (!row || row.orderId !== order.id) {
      issues.push(`${order.passCode}: pass code is attached to a different order`);
    }
  }

  const quotas = await tx.seasonPassZoneQuota.findMany({
    where: {
      seasonLabel: SEASON_LABEL,
      tierId: { in: ["vip-advanced", "premium", "gold"] },
    },
  });
  for (const tier of SEASON_TIERS.filter((item) => item.id !== "vvip-elite")) {
    const ranges = calculateSeasonPassZoneRanges(
      tier.allowedSeatZones,
      quotas.filter((quota) => quota.tierId === tier.id),
    );
    if (ranges.length !== tier.allowedSeatZones.length) {
      issues.push(`${tier.id}: zone quotas are incomplete`);
      continue;
    }
    for (const entry of SPONSOR_SEASON_PASS_ENTRIES.filter((item) => item.tierId === tier.id)) {
      const range = ranges.find((item) => item.seatZone === entry.seatZone);
      const sequence = Number(entry.barcode.slice(-4));
      if (!range || sequence <= range.publicEndSequence || sequence > range.endSequence) {
        issues.push(`${entry.barcode}: is outside the reserved sponsor block for ${entry.seatZone}`);
      }
    }
  }

  const internalGroups = await tx.seasonPassOrder.groupBy({
    by: ["tierId", "seatZone"],
    where: {
      seasonLabel: SEASON_LABEL,
      salesChannel: "INTERNAL",
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    _count: { _all: true },
  });
  for (const key of new Set(SPONSOR_SEASON_PASS_ENTRIES.map((entry) => `${entry.tierId}:${entry.seatZone}`))) {
    const [tierId, seatZone] = key.split(":");
    const quota = quotas.find((item) => item.tierId === tierId && item.seatZone === seatZone);
    const existingInternal = internalGroups.find(
      (item) => item.tierId === tierId && item.seatZone === seatZone,
    )?._count._all ?? 0;
    const incoming = wouldCreate.filter(
      (entry) => entry.tierId === tierId && entry.seatZone === seatZone,
    ).length;
    if (!quota || existingInternal + incoming > quota.sponsorReserved) {
      issues.push(
        `${key}: ${existingInternal + incoming} registered sponsor cards exceed reserved quota ${quota?.sponsorReserved ?? 0}`,
      );
    }
  }

  return { rowsByBarcode, issues: [...new Set(issues)], alreadyRegistered, wouldCreate };
}

async function main() {
  if (unexpectedArgs.length > 0) fail(`Unknown arguments: ${unexpectedArgs.join(", ")}`);
  if (
    apply &&
    process.env.NODE_ENV === "production" &&
    process.env.SEASON_PASS_ACCEPT_LEGACY_GATE_CODES !== "true"
  ) {
    fail("Production legacy physical-card scanning is disabled; refusing to register sponsor cards");
  }

  assertManifest();

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`season-pass-sponsor-import:${SEASON_LABEL}:${SPONSOR_SEASON_PASS_IMPORT_VERSION}`})
        )::text AS lock_result
      `;
      const targetBarcodes = SPONSOR_SEASON_PASS_ENTRIES.map((entry) => entry.barcode).sort();
      await tx.$queryRaw(
        Prisma.sql`
          SELECT "id"
          FROM "SeasonPassBarcode"
          WHERE "barcode" IN (${Prisma.join(targetBarcodes)})
          ORDER BY "barcode"
          FOR UPDATE
        `,
      );

      const inspection = await inspect(tx);
      if (inspection.issues.length > 0) {
        fail(`Safety checks failed:\n- ${inspection.issues.join("\n- ")}`);
      }

      if (!apply || inspection.wouldCreate.length === 0) {
        return {
          mode: apply ? "apply" : "dry-run",
          created: 0,
          wouldCreate: inspection.wouldCreate.length,
          alreadyRegistered: inspection.alreadyRegistered.length,
        };
      }

      const entitlementStartedAt = new Date();
      const settledMatches = await tx.seasonPassMatchFinalization.count({
        where: {
          seasonLabel: SEASON_LABEL,
          reversedAt: null,
          match: { kickoffAt: { lte: entitlementStartedAt } },
        },
      });
      const initialUses = calculateSeasonPassInitialUses(SEASON_MATCHES, settledMatches);

      await tx.seasonPassOrder.createMany({
        data: inspection.wouldCreate.map((entry) => ({
          passCode: entry.barcode,
          tierId: entry.tierId,
          seatZone: entry.seatZone,
          seasonLabel: SEASON_LABEL,
          priceBaht: 0,
          shippingFeeBaht: 0,
          customerId: null,
          customerName: entry.sponsorName,
          customerPhone: "",
          customerEmail: null,
          deliveryMethod: "PICKUP",
          pickupLocation: "สโมสร",
          paymentMethod: "SPONSOR",
          status: "CONFIRMED",
          salesChannel: "INTERNAL",
          entitlementStartedAt,
          notes: sponsorSeasonPassAuditMarker(entry),
        })),
      });

      const createdOrders = await tx.seasonPassOrder.findMany({
        where: { passCode: { in: inspection.wouldCreate.map((entry) => entry.barcode) } },
        select: { id: true, passCode: true },
      });
      const orderIdByPassCode = new Map(createdOrders.map((order) => [order.passCode, order.id]));
      if (createdOrders.length !== inspection.wouldCreate.length) {
        fail("Created order count does not match the manifest");
      }

      for (const entry of inspection.wouldCreate) {
        const row = inspection.rowsByBarcode.get(entry.barcode);
        const orderId = orderIdByPassCode.get(entry.barcode);
        if (!row || !orderId) fail(`${entry.barcode}: missing row during assignment`);
        const assigned = await tx.seasonPassBarcode.updateMany({
          where: {
            id: row.id,
            orderId: null,
            scans: { none: {} },
          },
          data: {
            orderId,
            assignedAt: entitlementStartedAt,
            usesRemaining: initialUses,
            isGenerated: true,
            legacyGateAllowed: true,
          },
        });
        if (assigned.count !== 1) fail(`${entry.barcode}: barcode assignment changed concurrently`);
      }

      const verification = await inspect(tx);
      if (verification.issues.length > 0 || verification.alreadyRegistered.length !== 91) {
        fail(
          `Post-write verification failed: ${verification.issues.join("; ") || `${verification.alreadyRegistered.length}/91 registered`}`,
        );
      }

      return {
        mode: "apply",
        created: inspection.wouldCreate.length,
        wouldCreate: 0,
        alreadyRegistered: verification.alreadyRegistered.length,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 },
  );

  const packageCounts = Object.fromEntries(
    ["vip-advanced", "premium", "gold"].map((tierId) => [
      tierId,
        SPONSOR_SEASON_PASS_ENTRIES.filter((entry) => entry.tierId === tierId).length,
    ]),
  );
  process.stdout.write(`${JSON.stringify({ ok: true, ...result, total: 91, packageCounts }, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
