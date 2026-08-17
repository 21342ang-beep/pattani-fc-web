ALTER TABLE "Match"
ADD COLUMN "competitionName" TEXT,
ADD COLUMN "competitionRound" TEXT,
ADD COLUMN "seasonPassEligible" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the current season-pass behaviour for existing Pattani FC home
-- league matches. Cup matches remain disabled until an admin enables each
-- match explicitly after the draw is known.
UPDATE "Match"
SET "seasonPassEligible" = true
WHERE "competitionType" = 'LEAGUE'
  AND (
    LOWER(BTRIM("homeTeam")) IN ('pattani fc', 'pattani f.c.', 'pattani')
    OR "homeTeam" LIKE '%ปัตตานี เอฟซี%'
  );

CREATE INDEX "Match_seasonPassEligible_kickoffAt_idx"
ON "Match"("seasonPassEligible", "kickoffAt");
