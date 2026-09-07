import { Prisma, type MatchStatus } from "@prisma/client";
import { isPattaniHomeTeam } from "@/lib/season-pass-home-match";
import { classifySeasonPassForMatch } from "@/lib/season-pass-entitlement-policy";
import { SEASON_LABEL, SEASON_MATCHES } from "@/lib/season-pass-tiers";

type TransactionClient = Prisma.TransactionClient;

export type LockedSeasonPassMatch = {
  id: string;
  status: MatchStatus;
  competitionType: "LEAGUE" | "CUP";
  homeTeam: string;
  awayTeam: string;
  seasonPassEligible: boolean;
  kickoffAt: Date | null;
};

type SettlementPass = {
  barcodeId: string;
  passCode: string;
  customerName: string;
  tierId: string;
  seatZone: string;
  usesRemaining: number;
  entitlementStartedAt: Date;
  scanned: boolean;
};

type ActiveFinalization = {
  matchId: string;
  finalizedAt: Date;
  finalizedBy: string;
  missedCount: number;
  postMatchCount: number;
};

export type SeasonPassSettlementGroup = {
  tierId: string;
  seatZone: string;
  confirmed: number;
  scanned: number;
  noShow: number;
  joinedAfterMatch: number;
};

export type SeasonPassSettlementPreview = {
  matchId: string;
  matchLabel: string;
  kickoffAt: Date | null;
  eligible: boolean;
  eligibilityError: string | null;
  active: boolean;
  finalizedAt: Date | null;
  finalizedBy: string | null;
  confirmedPasses: number;
  scannedPasses: number;
  noShowPasses: number;
  joinedAfterMatchPasses: number;
  missingBarcodeOrStart: number;
  groups: SeasonPassSettlementGroup[];
};

export type SeasonPassSettlementResult = {
  alreadySettled: boolean;
  missedCount: number;
  postMatchCount: number;
};

export async function lockSeasonPassMatch(
  tx: TransactionClient,
  matchId: string,
): Promise<LockedSeasonPassMatch | null> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "Match"
    WHERE "id" = ${matchId}
    FOR UPDATE
  `);

  return tx.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      competitionType: true,
      homeTeam: true,
      awayTeam: true,
      seasonPassEligible: true,
      kickoffAt: true,
    },
  });
}

async function lockAllSeasonBarcodes(tx: TransactionClient): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "SeasonPassBarcode"
    WHERE "seasonLabel" = ${SEASON_LABEL}
    ORDER BY "id"
    FOR UPDATE
  `);
}

function settlementEligibility(match: LockedSeasonPassMatch, now: Date): string | null {
  if (match.status !== "FINISHED") return "ต้องบันทึกผลการแข่งขันเป็นจบแล้วก่อน";
  if (match.competitionType !== "LEAGUE") return "บอลถ้วยไม่หักสิทธิ์บอลลีก";
  if (!match.seasonPassEligible) return "แมตช์นี้ไม่ได้เปิดให้ใช้บัตรรายปี";
  if (!isPattaniHomeTeam(match.homeTeam)) return "ตัดสิทธิ์ได้เฉพาะเกมเหย้าของปัตตานี เอฟซี";
  if (!match.kickoffAt || match.kickoffAt.getTime() > now.getTime()) {
    return "ยังไม่ถึงเวลาแข่งขันหรือยังไม่ได้กำหนดเวลาแข่งขัน";
  }
  return null;
}

async function inspectSettlement(
  tx: TransactionClient,
  matchId: string,
  now: Date,
): Promise<{
  match: LockedSeasonPassMatch;
  finalization: ActiveFinalization | null;
  passes: SettlementPass[];
  noShows: SettlementPass[];
  joinedAfterMatch: SettlementPass[];
  preview: SeasonPassSettlementPreview;
}> {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      competitionType: true,
      homeTeam: true,
      awayTeam: true,
      seasonPassEligible: true,
      kickoffAt: true,
    },
  });
  if (!match) throw new Error("MATCH_NOT_FOUND");

  const [finalizations, passes, missingBarcodeOrStart] = await Promise.all([
    tx.$queryRaw<ActiveFinalization[]>(Prisma.sql`
      SELECT
        "matchId",
        "finalizedAt",
        "finalizedBy",
        "missedCount",
        "postMatchCount"
      FROM "SeasonPassMatchFinalization"
      WHERE "matchId" = ${matchId}
        AND "reversedAt" IS NULL
    `),
    tx.$queryRaw<SettlementPass[]>(Prisma.sql`
      SELECT
        barcode."id" AS "barcodeId",
        season_order."passCode" AS "passCode",
        season_order."customerName" AS "customerName",
        barcode."tierId" AS "tierId",
        season_order."seatZone" AS "seatZone",
        barcode."usesRemaining" AS "usesRemaining",
        season_order."entitlementStartedAt" AS "entitlementStartedAt",
        EXISTS (
          SELECT 1
          FROM "SeasonPassScan" AS scan
          WHERE scan."barcodeId" = barcode."id"
            AND scan."matchId" = ${matchId}
        ) AS "scanned"
      FROM "SeasonPassBarcode" AS barcode
      INNER JOIN "SeasonPassOrder" AS season_order
        ON season_order."id" = barcode."orderId"
      WHERE barcode."seasonLabel" = ${SEASON_LABEL}
        AND season_order."seasonLabel" = ${SEASON_LABEL}
        AND season_order."status" = 'CONFIRMED'
        AND season_order."entitlementStartedAt" IS NOT NULL
      ORDER BY barcode."id"
    `),
    tx.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::integer AS "count"
      FROM "SeasonPassOrder" AS season_order
      LEFT JOIN "SeasonPassBarcode" AS barcode ON barcode."orderId" = season_order."id"
      WHERE season_order."seasonLabel" = ${SEASON_LABEL}
        AND season_order."status" = 'CONFIRMED'
        AND (barcode."id" IS NULL OR season_order."entitlementStartedAt" IS NULL)
    `),
  ]);
  const finalization = finalizations[0] ?? null;
  const unscannedWithUse = passes.filter((pass) => !pass.scanned && pass.usesRemaining > 0);
  const noShows = match.kickoffAt
    ? unscannedWithUse.filter((pass) =>
        classifySeasonPassForMatch(pass.entitlementStartedAt, match.kickoffAt!) === "HOLDER_AT_KICKOFF"
      )
    : [];
  const joinedAfterMatch = match.kickoffAt
    ? unscannedWithUse.filter((pass) =>
        classifySeasonPassForMatch(pass.entitlementStartedAt, match.kickoffAt!) === "JOINED_AFTER_MATCH"
      )
    : [];
  const noShowIds = new Set(noShows.map((pass) => pass.barcodeId));
  const joinedIds = new Set(joinedAfterMatch.map((pass) => pass.barcodeId));

  const grouped = new Map<string, SeasonPassSettlementGroup>();
  for (const pass of passes) {
    const key = `${pass.tierId}:${pass.seatZone}`;
    const group = grouped.get(key) ?? {
      tierId: pass.tierId,
      seatZone: pass.seatZone,
      confirmed: 0,
      scanned: 0,
      noShow: 0,
      joinedAfterMatch: 0,
    };
    group.confirmed += 1;
    if (pass.scanned) group.scanned += 1;
    if (noShowIds.has(pass.barcodeId)) group.noShow += 1;
    if (joinedIds.has(pass.barcodeId)) group.joinedAfterMatch += 1;
    grouped.set(key, group);
  }

  const eligibilityError = settlementEligibility(match, now);
  return {
    match,
    finalization,
    passes,
    noShows,
    joinedAfterMatch,
    preview: {
      matchId: match.id,
      matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffAt: match.kickoffAt,
      eligible: eligibilityError == null,
      eligibilityError,
      active: finalization != null,
      finalizedAt: finalization?.finalizedAt ?? null,
      finalizedBy: finalization?.finalizedBy ?? null,
      confirmedPasses: passes.length,
      scannedPasses: passes.filter((pass) => pass.scanned).length,
      noShowPasses: finalization?.missedCount ?? noShows.length,
      joinedAfterMatchPasses: finalization?.postMatchCount ?? joinedAfterMatch.length,
      missingBarcodeOrStart: missingBarcodeOrStart[0]?.count ?? 0,
      groups: [...grouped.values()].sort((left, right) =>
        left.tierId.localeCompare(right.tierId) || left.seatZone.localeCompare(right.seatZone, "th")
      ),
    },
  };
}

export async function previewSeasonPassMatchSettlement(
  tx: TransactionClient,
  matchId: string,
  now = new Date(),
): Promise<SeasonPassSettlementPreview> {
  return (await inspectSettlement(tx, matchId, now)).preview;
}

export async function settleSeasonPassMatch(
  tx: TransactionClient,
  matchId: string,
  actorId: string,
  now = new Date(),
): Promise<SeasonPassSettlementResult> {
  const lockedMatch = await lockSeasonPassMatch(tx, matchId);
  if (!lockedMatch) throw new Error("MATCH_NOT_FOUND");
  await lockAllSeasonBarcodes(tx);

  const inspection = await inspectSettlement(tx, matchId, now);
  if (!inspection.preview.eligible) {
    throw new Error(`MATCH_NOT_SETTLEABLE:${inspection.preview.eligibilityError ?? "unknown"}`);
  }
  if (inspection.finalization) {
    return {
      alreadySettled: true,
      missedCount: inspection.finalization.missedCount,
      postMatchCount: inspection.finalization.postMatchCount,
    };
  }
  if (inspection.preview.missingBarcodeOrStart > 0) {
    throw new Error("SEASON_PASS_ENTITLEMENT_INCOMPLETE");
  }

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "SeasonPassMatchFinalization" (
      "matchId", "seasonLabel", "finalizedAt", "finalizedBy",
      "reversedAt", "reversedBy", "missedCount", "postMatchCount"
    ) VALUES (
      ${matchId}, ${SEASON_LABEL}, ${now}, ${actorId},
      NULL, NULL, ${inspection.noShows.length}, ${inspection.joinedAfterMatch.length}
    )
    ON CONFLICT ("matchId") DO UPDATE SET
      "seasonLabel" = EXCLUDED."seasonLabel",
      "finalizedAt" = EXCLUDED."finalizedAt",
      "finalizedBy" = EXCLUDED."finalizedBy",
      "reversedAt" = NULL,
      "reversedBy" = NULL,
      "missedCount" = EXCLUDED."missedCount",
      "postMatchCount" = EXCLUDED."postMatchCount"
  `);

  if (inspection.noShows.length > 0) {
    const values = inspection.noShows.map((candidate) => Prisma.sql`(
      ${candidate.barcodeId}, ${matchId}, ${candidate.passCode}, ${candidate.customerName},
      ${candidate.tierId}, ${candidate.seatZone}, ${candidate.usesRemaining},
      ${candidate.usesRemaining - 1}, ${now}, ${actorId}, NULL, NULL
    )`);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SeasonPassAbsence" (
        "barcodeId", "matchId", "passCode", "customerName", "tierId", "seatZone",
        "usesBefore", "usesAfter", "deductedAt", "deductedBy", "restoredAt", "restoredBy"
      ) VALUES ${Prisma.join(values)}
      ON CONFLICT ("barcodeId", "matchId") DO UPDATE SET
        "passCode" = EXCLUDED."passCode",
        "customerName" = EXCLUDED."customerName",
        "tierId" = EXCLUDED."tierId",
        "seatZone" = EXCLUDED."seatZone",
        "usesBefore" = EXCLUDED."usesBefore",
        "usesAfter" = EXCLUDED."usesAfter",
        "deductedAt" = EXCLUDED."deductedAt",
        "deductedBy" = EXCLUDED."deductedBy",
        "restoredAt" = NULL,
        "restoredBy" = NULL
    `);
  }

  const noShowUpdate = inspection.noShows.length === 0
    ? { count: 0 }
    : await tx.seasonPassBarcode.updateMany({
        where: { id: { in: inspection.noShows.map((pass) => pass.barcodeId) }, usesRemaining: { gt: 0 } },
        data: { usesRemaining: { decrement: 1 } },
      });
  const postMatchUpdate = inspection.joinedAfterMatch.length === 0
    ? { count: 0 }
    : await tx.seasonPassBarcode.updateMany({
        where: { id: { in: inspection.joinedAfterMatch.map((pass) => pass.barcodeId) }, usesRemaining: { gt: 0 } },
        data: { usesRemaining: { decrement: 1 } },
      });
  if (noShowUpdate.count !== inspection.noShows.length || postMatchUpdate.count !== inspection.joinedAfterMatch.length) {
    throw new Error("SEASON_PASS_SETTLEMENT_COUNT_MISMATCH");
  }

  return {
    alreadySettled: false,
    missedCount: inspection.noShows.length,
    postMatchCount: inspection.joinedAfterMatch.length,
  };
}

export async function reverseSeasonPassMatchSettlement(
  tx: TransactionClient,
  matchId: string,
  actorId: string,
  now = new Date(),
): Promise<{ restoredAbsences: number; restoredLaterBuyers: number }> {
  const match = await lockSeasonPassMatch(tx, matchId);
  if (!match) throw new Error("MATCH_NOT_FOUND");
  await lockAllSeasonBarcodes(tx);

  const activeFinalization = await tx.$queryRaw<ActiveFinalization[]>(Prisma.sql`
    SELECT "matchId", "finalizedAt", "finalizedBy", "missedCount", "postMatchCount"
    FROM "SeasonPassMatchFinalization"
    WHERE "matchId" = ${matchId} AND "reversedAt" IS NULL
    FOR UPDATE
  `);
  if (activeFinalization.length === 0) return { restoredAbsences: 0, restoredLaterBuyers: 0 };
  if (!match.kickoffAt) throw new Error("MATCH_KICKOFF_MISSING");

  const activeAbsences = await tx.$queryRaw<{ barcodeId: string }[]>(Prisma.sql`
    SELECT "barcodeId"
    FROM "SeasonPassAbsence"
    WHERE "matchId" = ${matchId} AND "restoredAt" IS NULL
    ORDER BY "barcodeId"
  `);
  const laterBuyerRows = await tx.$queryRaw<{ barcodeId: string }[]>(Prisma.sql`
    SELECT barcode."id" AS "barcodeId"
    FROM "SeasonPassBarcode" AS barcode
    INNER JOIN "SeasonPassOrder" AS season_order ON season_order."id" = barcode."orderId"
    WHERE barcode."seasonLabel" = ${SEASON_LABEL}
      AND season_order."seasonLabel" = ${SEASON_LABEL}
      AND season_order."status" = 'CONFIRMED'
      AND season_order."entitlementStartedAt" > ${match.kickoffAt}
      AND barcode."usesRemaining" < ${SEASON_MATCHES}
      AND NOT EXISTS (
        SELECT 1 FROM "SeasonPassScan" AS scan
        WHERE scan."barcodeId" = barcode."id" AND scan."matchId" = ${matchId}
      )
    ORDER BY barcode."id"
  `);

  const absenceRestore = activeAbsences.length === 0
    ? { count: 0 }
    : await tx.seasonPassBarcode.updateMany({
        where: { id: { in: activeAbsences.map((row) => row.barcodeId) }, usesRemaining: { lt: SEASON_MATCHES } },
        data: { usesRemaining: { increment: 1 } },
      });
  const laterBuyerRestore = laterBuyerRows.length === 0
    ? { count: 0 }
    : await tx.seasonPassBarcode.updateMany({
        where: { id: { in: laterBuyerRows.map((row) => row.barcodeId) }, usesRemaining: { lt: SEASON_MATCHES } },
        data: { usesRemaining: { increment: 1 } },
      });
  if (absenceRestore.count !== activeAbsences.length || laterBuyerRestore.count !== laterBuyerRows.length) {
    throw new Error("SEASON_PASS_SETTLEMENT_RESTORE_MISMATCH");
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "SeasonPassAbsence"
    SET "restoredAt" = ${now}, "restoredBy" = ${actorId}
    WHERE "matchId" = ${matchId} AND "restoredAt" IS NULL
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SeasonPassMatchFinalization"
    SET "reversedAt" = ${now}, "reversedBy" = ${actorId}
    WHERE "matchId" = ${matchId} AND "reversedAt" IS NULL
  `);

  return { restoredAbsences: activeAbsences.length, restoredLaterBuyers: laterBuyerRows.length };
}

export async function removeSeasonPassMatchFinalization(
  tx: TransactionClient,
  matchId: string,
  actorId: string,
): Promise<void> {
  await reverseSeasonPassMatchSettlement(tx, matchId, actorId);
  await tx.$executeRaw(Prisma.sql`DELETE FROM "SeasonPassMatchFinalization" WHERE "matchId" = ${matchId}`);
}

export async function hasActiveSeasonPassFinalization(
  tx: TransactionClient,
  matchId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM "SeasonPassMatchFinalization"
      WHERE "matchId" = ${matchId} AND "reversedAt" IS NULL
    ) AS "exists"
  `);
  return rows[0]?.exists === true;
}
