-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "customerEmail" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Booking_customerPhone_idx" ON "Booking"("customerPhone");
