-- Revert the result-only match marker after rolling back that feature.
DROP INDEX IF EXISTS "Match_isResultOnly_idx";
ALTER TABLE "Match" DROP COLUMN "isResultOnly";
