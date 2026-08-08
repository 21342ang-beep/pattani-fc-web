-- Backward-compatible rollout: existing customers remain usable and unverified.
ALTER TABLE "Customer" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
