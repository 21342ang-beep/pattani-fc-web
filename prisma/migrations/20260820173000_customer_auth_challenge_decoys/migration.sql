-- Account-existence decoys must follow the same persisted OTP lifecycle as a
-- real request. A NULL reset owner can never mutate credentials, while the
-- registration eligibility flag is checked again under the challenge lock.
ALTER TABLE "CustomerPasswordResetOtp"
  ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "CustomerRegistrationChallenge"
  ADD COLUMN "activationEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "CustomerRegistrationChallenge"
  ALTER COLUMN "activationEligible" DROP DEFAULT;

-- Keep exactly one live reset challenge per real customer while allowing any
-- number of short-lived NULL-owner decoys. Preserve only the newest legacy row
-- before installing the partial unique index.
WITH ranked AS (
  SELECT "id",
    row_number() OVER (
      PARTITION BY "customerId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS position
  FROM "CustomerPasswordResetOtp"
  WHERE "customerId" IS NOT NULL
)
DELETE FROM "CustomerPasswordResetOtp" challenge
USING ranked
WHERE challenge."id" = ranked."id"
  AND ranked.position > 1;

CREATE UNIQUE INDEX "CustomerPasswordResetOtp_customerId_live_key"
  ON "CustomerPasswordResetOtp"("customerId")
  WHERE "customerId" IS NOT NULL;
