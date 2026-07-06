-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "scannedAt" TIMESTAMP(3),
ADD COLUMN     "scannedBy" TEXT;

-- CreateIndex
CREATE INDEX "Booking_scannedAt_idx" ON "Booking"("scannedAt");
