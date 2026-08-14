-- Timed holds apply only to new online purchases. Existing NULL rows keep their
-- current behavior, so this additive migration cannot cancel historical orders.
ALTER TABLE "SeasonPassPurchase" ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

CREATE INDEX "SeasonPassPurchase_status_paymentExpiresAt_idx"
ON "SeasonPassPurchase"("status", "paymentExpiresAt");
