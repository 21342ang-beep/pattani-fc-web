CREATE TABLE "BookingSearchOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "providerToken" TEXT NOT NULL,
    "reference" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSearchOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingSearchOtp_phone_createdAt_idx"
ON "BookingSearchOtp"("phone", "createdAt");

CREATE INDEX "BookingSearchOtp_expiresAt_idx"
ON "BookingSearchOtp"("expiresAt");
