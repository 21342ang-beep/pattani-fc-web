import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { getBulkScanDeficit } from "../src/lib/booking-bulk-scan-policy";

const prisma = new PrismaClient();

const TARGET_HOME_TEAM = "ปัตตานี เอฟซี";
const TARGET_AWAY_TEAM = "บีจี ปทุม ยูไนเต็ด";
const SCANNED_BY_MARKER = "match-close:2026-09-07:pattani-vs-bg-pathum";

const apply = process.argv.includes("--apply");
const verifyRollback = process.argv.includes("--verify-rollback");
const expectedArgs = new Set(["--apply", "--verify-rollback"]);
const unexpectedArgs = process.argv.slice(2).filter((argument) => !expectedArgs.has(argument));

type DbClient = Prisma.TransactionClient | typeof prisma;

function fail(message: string): never {
  throw new Error(message);
}

function scanId(): string {
  // Lowercase hexadecimal remains compatible with the existing scan-delete validator.
  return randomBytes(16).toString("hex");
}

class RollbackVerification extends Error {
  constructor() {
    super("ROLLBACK_VERIFICATION");
  }
}

async function findTargetMatch(db: DbClient) {
  const matches = await db.match.findMany({
    where: {
      homeTeam: TARGET_HOME_TEAM,
      awayTeam: TARGET_AWAY_TEAM,
    },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      kickoffAt: true,
      status: true,
    },
  });

  if (matches.length !== 1) {
    fail(
      `Expected exactly one ${TARGET_HOME_TEAM} vs ${TARGET_AWAY_TEAM} match; found ${matches.length}`,
    );
  }

  const match = matches[0];
  if (!match.kickoffAt) fail("Target match has no kickoff date; refusing to continue");
  if (match.kickoffAt.getTime() >= Date.now()) {
    fail("Target match kickoff is not in the past; refusing to continue");
  }
  if (match.status === "CANCELLED") fail("Target match is cancelled; refusing to continue");

  return match;
}

async function inspectTarget(db: DbClient, matchId: string) {
  const [bookings, statusGroups, targetConfirmedMarkerScans, targetNonConfirmedMarkerScans, otherMatchMarkerScans] = await Promise.all([
    db.booking.findMany({
      where: { matchId },
      select: {
        id: true,
        status: true,
        quantity: true,
        zone: true,
        scannedAt: true,
        scannedBy: true,
        _count: { select: { gateScans: true } },
      },
      orderBy: { id: "asc" },
    }),
    db.booking.groupBy({
      by: ["status"],
      where: { matchId },
      _count: { _all: true },
      _sum: { quantity: true },
    }),
    db.bookingGateScan.count({
      where: {
        scannedBy: SCANNED_BY_MARKER,
        booking: { matchId, status: "CONFIRMED" },
      },
    }),
    db.bookingGateScan.count({
      where: {
        scannedBy: SCANNED_BY_MARKER,
        booking: { matchId, status: { not: "CONFIRMED" } },
      },
    }),
    db.bookingGateScan.count({
      where: {
        scannedBy: SCANNED_BY_MARKER,
        booking: { matchId: { not: matchId } },
      },
    }),
  ]);

  const targets = bookings
    .map((booking) => ({
      ...booking,
      missingScans: getBulkScanDeficit({
        status: booking.status,
        quantity: booking.quantity,
        scanCount: booking._count.gateScans,
      }),
    }))
    .filter((booking) => booking.missingScans > 0);

  const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");
  const zones = new Map<string, { bookings: number; tickets: number; existingScans: number; missingScans: number }>();
  for (const booking of confirmed) {
    const zone = booking.zone ?? "ไม่ระบุโซน";
    const summary = zones.get(zone) ?? { bookings: 0, tickets: 0, existingScans: 0, missingScans: 0 };
    summary.bookings += 1;
    summary.tickets += Math.max(booking.quantity, 0);
    summary.existingScans += booking._count.gateScans;
    summary.missingScans += getBulkScanDeficit({
      status: booking.status,
      quantity: booking.quantity,
      scanCount: booking._count.gateScans,
    });
    zones.set(zone, summary);
  }

  return {
    bookings,
    targets,
    statusGroups,
    summary: {
      confirmedBookings: confirmed.length,
      confirmedTickets: confirmed.reduce((sum, booking) => sum + Math.max(booking.quantity, 0), 0),
      existingScans: confirmed.reduce((sum, booking) => sum + booking._count.gateScans, 0),
      bookingsNeedingScans: targets.length,
      missingScans: targets.reduce((sum, booking) => sum + booking.missingScans, 0),
    },
    operationMarker: {
      targetConfirmedScans: targetConfirmedMarkerScans,
      targetNonConfirmedScans: targetNonConfirmedMarkerScans,
      otherMatchScans: otherMatchMarkerScans,
    },
    zones: [...zones.entries()]
      .map(([zone, value]) => ({ zone, ...value }))
      .sort((left, right) => left.zone.localeCompare(right.zone, "th")),
  };
}

async function report(mode: "dry-run" | "applied", match: Awaited<ReturnType<typeof findTargetMatch>>, inspection: Awaited<ReturnType<typeof inspectTarget>>) {
  console.log(JSON.stringify({
    mode,
    marker: SCANNED_BY_MARKER,
    match: {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoffAt: match.kickoffAt?.toISOString() ?? null,
      status: match.status,
    },
    bookingStatuses: inspection.statusGroups.map((group) => ({
      status: group.status,
      bookings: group._count._all,
      tickets: group._sum.quantity ?? 0,
    })),
    summary: inspection.summary,
    operationMarker: inspection.operationMarker,
    zones: inspection.zones,
  }, null, 2));
}

function snapshot(inspection: Awaited<ReturnType<typeof inspectTarget>>): string {
  return JSON.stringify(inspection.bookings.map((booking) => ({
    id: booking.id,
    status: booking.status,
    quantity: booking.quantity,
    zone: booking.zone,
    scannedAt: booking.scannedAt?.toISOString() ?? null,
    scannedBy: booking.scannedBy,
    scanCount: booking._count.gateScans,
  })));
}

async function applyMissingScans(
  match: Awaited<ReturnType<typeof findTargetMatch>>,
  rollbackAfterVerification: boolean,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`complete-match-booking-scans:${match.id}`})
      )::text AS lock_result
    `;
    await tx.$queryRaw(
      Prisma.sql`
        SELECT "id"
        FROM "Booking"
        WHERE "matchId" = ${match.id}
        ORDER BY "id"
        FOR UPDATE
      `,
    );

    const currentMatch = await findTargetMatch(tx);
    if (currentMatch.id !== match.id) fail("Target match changed while acquiring the lock");
    const current = await inspectTarget(tx, match.id);
    const scannedAt = new Date();
    if (!rollbackAfterVerification) {
      const backupDirectory = resolve(process.cwd(), "ops-backups");
      const backupPath = resolve(
        backupDirectory,
        `bg-pathum-before-scan-${scannedAt.toISOString().replaceAll(":", "-")}.json`,
      );
      await mkdir(backupDirectory, { recursive: true });
      await writeFile(backupPath, JSON.stringify({
        createdAt: scannedAt.toISOString(),
        marker: SCANNED_BY_MARKER,
        match: currentMatch,
        bookings: current.bookings.map((booking) => ({
          id: booking.id,
          status: booking.status,
          quantity: booking.quantity,
          zone: booking.zone,
          scannedAt: booking.scannedAt?.toISOString() ?? null,
          scannedBy: booking.scannedBy,
          gateScanCount: booking._count.gateScans,
        })),
      }, null, 2), { encoding: "utf8", flag: "wx" });
      console.log(`Rollback manifest: ${backupPath}`);
    }
    const rows = current.targets.flatMap((booking) =>
      Array.from({ length: booking.missingScans }, () => ({
        id: scanId(),
        bookingId: booking.id,
        scannedAt,
        scannedBy: SCANNED_BY_MARKER,
      })),
    );

    if (rows.length > 0) {
      await tx.bookingGateScan.createMany({ data: rows });
      await tx.booking.updateMany({
        where: {
          id: { in: current.targets.map((booking) => booking.id) },
          scannedAt: null,
        },
        data: { scannedAt, scannedBy: SCANNED_BY_MARKER },
      });
    }

    const after = await inspectTarget(tx, match.id);
    if (after.summary.missingScans !== 0) {
      fail(`Verification failed: ${after.summary.missingScans} target scans are still missing`);
    }
    if (after.summary.confirmedBookings !== current.summary.confirmedBookings) {
      fail("Verification failed: confirmed booking count changed");
    }
    if (after.summary.confirmedTickets !== current.summary.confirmedTickets) {
      fail("Verification failed: confirmed ticket count changed");
    }
    if (after.summary.existingScans !== current.summary.existingScans + rows.length) {
      fail("Verification failed: inserted scan count does not match the plan");
    }
    if (rollbackAfterVerification) throw new RollbackVerification();

    return { after, inserted: rows.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });
}

async function main() {
  if (unexpectedArgs.length > 0) fail(`Unknown arguments: ${unexpectedArgs.join(", ")}`);
  if (apply && verifyRollback) fail("Use either --apply or --verify-rollback, not both");

  const match = await findTargetMatch(prisma);
  const before = await inspectTarget(prisma, match.id);
  await report("dry-run", match, before);
  if (verifyRollback) {
    const beforeSnapshot = snapshot(before);
    try {
      await applyMissingScans(match, true);
      fail("Rollback verification did not abort its transaction");
    } catch (error) {
      if (!(error instanceof RollbackVerification)) throw error;
    }
    const afterRollback = await inspectTarget(prisma, match.id);
    if (snapshot(afterRollback) !== beforeSnapshot) {
      fail("Rollback verification failed: local booking or scan data changed");
    }
    console.log("Transaction apply checks passed and rollback restored the exact starting state.");
    return;
  }
  if (!apply) return;
  if (before.summary.missingScans === 0) {
    console.log("No missing scans; nothing was changed.");
    return;
  }

  const applied = await applyMissingScans(match, false);

  console.log(`Inserted ${applied.inserted} match-ticket scan records.`);
  await report("applied", match, applied.after);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
