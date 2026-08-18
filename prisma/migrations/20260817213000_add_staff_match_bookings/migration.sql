-- Keep staff-assisted match bookings distinguishable from public website orders.
CREATE TYPE "BookingSalesChannel" AS ENUM ('ONLINE', 'STAFF');
CREATE TYPE "BookingAuditAction" AS ENUM ('STAFF_CREATED', 'STATUS_CHANGED', 'DELETED');

ALTER TABLE "Booking"
  ADD COLUMN "salesChannel" "BookingSalesChannel" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "offlineReceiptNo" TEXT,
  ADD COLUMN "soldAt" TIMESTAMP(3),
  ADD COLUMN "soldById" TEXT;

CREATE TABLE "BookingAuditLog" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "bookingCode" TEXT NOT NULL,
  "action" "BookingAuditAction" NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorLabel" TEXT NOT NULL,
  "previousStatus" "BookingStatus",
  "nextStatus" "BookingStatus",
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Booking_salesChannel_createdAt_idx" ON "Booking"("salesChannel", "createdAt");
CREATE INDEX "Booking_soldById_idx" ON "Booking"("soldById");
CREATE INDEX "BookingAuditLog_bookingId_createdAt_idx" ON "BookingAuditLog"("bookingId", "createdAt");
CREATE INDEX "BookingAuditLog_bookingCode_createdAt_idx" ON "BookingAuditLog"("bookingCode", "createdAt");
CREATE INDEX "BookingAuditLog_actorId_createdAt_idx" ON "BookingAuditLog"("actorId", "createdAt");

ALTER TABLE "BookingAuditLog"
  ADD CONSTRAINT "BookingAuditLog_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
