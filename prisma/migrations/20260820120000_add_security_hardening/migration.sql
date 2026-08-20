-- Revoke administrator and customer sessions after credential or permission
-- changes without relying on timestamp precision.
ALTER TABLE "User"
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Customer"
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

-- Bind new match bookings to the authenticated customer. Keep the legacy
-- email column for receipts/search and backfill only email-verified owners.
ALTER TABLE "Booking"
  ADD COLUMN "customerId" TEXT;

UPDATE "Booking" AS booking
SET "customerId" = customer."id"
FROM "Customer" AS customer
WHERE booking."customerId" IS NULL
  AND booking."customerEmail" IS NOT NULL
  AND customer."emailVerifiedAt" IS NOT NULL
  AND lower(trim(booking."customerEmail")) = lower(trim(customer."email"));

CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- One atomic rate-limit store shared by every PM2/Node worker. Only SHA-256
-- hashes are stored, never raw IP addresses, phone numbers, or account names.
CREATE TABLE "SecurityRateLimit" (
  "keyHash" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityRateLimit_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "SecurityRateLimit_expiresAt_idx"
  ON "SecurityRateLimit"("expiresAt");
