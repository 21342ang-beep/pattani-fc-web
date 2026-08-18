ALTER TABLE "Booking" ADD COLUMN "staffRequestId" TEXT;
CREATE UNIQUE INDEX "Booking_staffRequestId_key" ON "Booking"("staffRequestId");
