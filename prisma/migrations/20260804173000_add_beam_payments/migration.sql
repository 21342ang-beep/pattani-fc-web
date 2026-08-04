CREATE TABLE "BeamPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "seasonPassOrderId" TEXT,
    "referenceId" TEXT NOT NULL,
    "chargeId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "qrImageBase64" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeamPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BeamPayment_referenceId_key" ON "BeamPayment"("referenceId");
CREATE UNIQUE INDEX "BeamPayment_chargeId_key" ON "BeamPayment"("chargeId");
CREATE UNIQUE INDEX "BeamPayment_idempotencyKey_key" ON "BeamPayment"("idempotencyKey");
CREATE INDEX "BeamPayment_bookingId_status_idx" ON "BeamPayment"("bookingId", "status");
CREATE INDEX "BeamPayment_seasonPassOrderId_status_idx" ON "BeamPayment"("seasonPassOrderId", "status");
CREATE INDEX "BeamPayment_expiresAt_idx" ON "BeamPayment"("expiresAt");

ALTER TABLE "BeamPayment" ADD CONSTRAINT "BeamPayment_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BeamPayment" ADD CONSTRAINT "BeamPayment_seasonPassOrderId_fkey"
FOREIGN KEY ("seasonPassOrderId") REFERENCES "SeasonPassOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
