-- CreateTable
CREATE TABLE "XenditPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qrString" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XenditPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XenditPayment_referenceId_key" ON "XenditPayment"("referenceId");
CREATE UNIQUE INDEX "XenditPayment_paymentRequestId_key" ON "XenditPayment"("paymentRequestId");
CREATE UNIQUE INDEX "XenditPayment_paymentId_key" ON "XenditPayment"("paymentId");
CREATE INDEX "XenditPayment_bookingId_status_idx" ON "XenditPayment"("bookingId", "status");

-- AddForeignKey
ALTER TABLE "XenditPayment" ADD CONSTRAINT "XenditPayment_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
