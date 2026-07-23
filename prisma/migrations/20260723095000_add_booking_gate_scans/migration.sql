CREATE TABLE "BookingGateScan" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedBy" TEXT NOT NULL,

    CONSTRAINT "BookingGateScan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingGateScan"
ADD CONSTRAINT "BookingGateScan_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BookingGateScan_bookingId_scannedAt_idx"
ON "BookingGateScan"("bookingId", "scannedAt");

-- Preserve the one-time scans recorded by the earlier gate implementation.
INSERT INTO "BookingGateScan" ("id", "bookingId", "scannedAt", "scannedBy")
SELECT 'legacy-' || "id", "id", "scannedAt", COALESCE("scannedBy", 'legacy')
FROM "Booking"
WHERE "scannedAt" IS NOT NULL;
