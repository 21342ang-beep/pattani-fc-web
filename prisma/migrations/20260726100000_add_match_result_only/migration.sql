-- Keep result-entry fixtures out of the public match programme.
ALTER TABLE "Match" ADD COLUMN "isResultOnly" BOOLEAN NOT NULL DEFAULT false;

-- Existing completed fixtures are historical results rather than ticket-sale fixtures.
UPDATE "Match"
SET "isResultOnly" = true
WHERE "status" = 'FINISHED';

CREATE INDEX "Match_isResultOnly_idx" ON "Match"("isResultOnly");
