-- BeamPayment rows were historically inserted without an explicit createdAt.
-- On databases whose TimeZone is not UTC, the timestamp-without-time-zone
-- default therefore stored the database-local wall clock while provider and
-- Prisma timestamps were stored as UTC-naive values.
--
-- Only repair rows that are impossible as stored (created after their own QR
-- expiry), and only when interpreting createdAt in the database timezone and
-- converting it to UTC produces a plausible timestamp before that expiry.
WITH candidates AS (
  SELECT
    "id",
    (("createdAt" AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'UTC') AS "utcCreatedAt"
  FROM "BeamPayment"
  WHERE "expiresAt" IS NOT NULL
    AND "createdAt" > "expiresAt"
)
UPDATE "BeamPayment" AS payment
SET "createdAt" = candidates."utcCreatedAt"
FROM candidates
WHERE payment."id" = candidates."id"
  AND candidates."utcCreatedAt" < payment."createdAt"
  AND candidates."utcCreatedAt" <= payment."expiresAt";
