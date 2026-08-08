ALTER TABLE "Booking" ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

-- Existing unpaid bookings must not keep seats indefinitely. The original
-- booking time is the safest available deadline for records created before
-- this column existed.
UPDATE "Booking"
SET "paymentExpiresAt" = "createdAt" + INTERVAL '15 minutes'
WHERE "status" = 'PENDING' AND "paymentExpiresAt" IS NULL;

CREATE INDEX "Booking_status_paymentExpiresAt_idx"
ON "Booking"("status", "paymentExpiresAt");
