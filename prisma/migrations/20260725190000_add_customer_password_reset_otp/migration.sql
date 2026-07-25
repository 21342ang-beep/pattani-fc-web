CREATE TABLE "CustomerPasswordResetOtp" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerToken" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerPasswordResetOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerPasswordResetOtp_customerId_createdAt_idx" ON "CustomerPasswordResetOtp"("customerId", "createdAt");
CREATE INDEX "CustomerPasswordResetOtp_expiresAt_idx" ON "CustomerPasswordResetOtp"("expiresAt");
ALTER TABLE "CustomerPasswordResetOtp" ADD CONSTRAINT "CustomerPasswordResetOtp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
