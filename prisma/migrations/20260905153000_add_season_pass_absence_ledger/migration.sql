CREATE TABLE "SeasonPassMatchFinalization" (
    "matchId" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "finalizedBy" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "missedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SeasonPassMatchFinalization_pkey" PRIMARY KEY ("matchId"),
    CONSTRAINT "SeasonPassMatchFinalization_missedCount_check" CHECK ("missedCount" >= 0)
);

CREATE TABLE "SeasonPassAbsence" (
    "barcodeId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "passCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "seatZone" TEXT NOT NULL,
    "usesBefore" INTEGER NOT NULL,
    "usesAfter" INTEGER NOT NULL,
    "deductedAt" TIMESTAMP(3) NOT NULL,
    "deductedBy" TEXT NOT NULL,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" TEXT,

    CONSTRAINT "SeasonPassAbsence_pkey" PRIMARY KEY ("barcodeId", "matchId"),
    CONSTRAINT "SeasonPassAbsence_uses_check" CHECK (
        "usesBefore" > 0 AND "usesAfter" = "usesBefore" - 1
    )
);

CREATE INDEX "SeasonPassMatchFinalization_reversedAt_finalizedAt_idx"
ON "SeasonPassMatchFinalization"("reversedAt", "finalizedAt");

CREATE INDEX "SeasonPassAbsence_matchId_restoredAt_idx"
ON "SeasonPassAbsence"("matchId", "restoredAt");

CREATE INDEX "SeasonPassAbsence_tierId_restoredAt_deductedAt_idx"
ON "SeasonPassAbsence"("tierId", "restoredAt", "deductedAt");

ALTER TABLE "SeasonPassMatchFinalization"
ADD CONSTRAINT "SeasonPassMatchFinalization_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeasonPassAbsence"
ADD CONSTRAINT "SeasonPassAbsence_barcodeId_fkey"
FOREIGN KEY ("barcodeId") REFERENCES "SeasonPassBarcode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonPassAbsence"
ADD CONSTRAINT "SeasonPassAbsence_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "SeasonPassMatchFinalization"("matchId") ON DELETE CASCADE ON UPDATE CASCADE;
