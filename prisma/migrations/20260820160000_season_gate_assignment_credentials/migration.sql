ALTER TABLE "SeasonPassBarcode"
ADD COLUMN "gateVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "gateNonce" TEXT,
ADD COLUMN "legacyGateAllowed" BOOLEAN NOT NULL DEFAULT false;

-- Only cards that are already attached to a customer at rollout may use the
-- explicit SPG1/raw transition. Blank inventory must be reprinted as SPG2
-- before it is assigned, so a future assignment cannot resurrect a legacy
-- credential.
UPDATE "SeasonPassBarcode"
SET
  "gateNonce" = gen_random_uuid()::text,
  "legacyGateAllowed" = (
    "isGenerated" = true
    AND EXISTS (
      SELECT 1
      FROM "SeasonPassOrder" o
      WHERE o."id" = "SeasonPassBarcode"."orderId"
        AND o."status" = 'CONFIRMED'
    )
  );

ALTER TABLE "SeasonPassBarcode"
ALTER COLUMN "gateNonce" SET NOT NULL,
ALTER COLUMN "gateNonce" SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX "SeasonPassBarcode_gateNonce_key"
ON "SeasonPassBarcode"("gateNonce");
