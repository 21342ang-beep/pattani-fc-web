ALTER TABLE "SeasonPassOrder"
ADD COLUMN "entitlementStartedAt" TIMESTAMP(3);

-- Existing confirmed cards already belonged to their holders when their
-- barcode was assigned. Preserve that historical start time exactly.
UPDATE "SeasonPassOrder" AS season_order
SET "entitlementStartedAt" = barcode."assignedAt"
FROM "SeasonPassBarcode" AS barcode
WHERE barcode."orderId" = season_order."id"
  AND season_order."status" = 'CONFIRMED'
  AND barcode."assignedAt" IS NOT NULL
  AND season_order."entitlementStartedAt" IS NULL;

CREATE INDEX "SeasonPassOrder_seasonLabel_status_entitlementStartedAt_idx"
ON "SeasonPassOrder"("seasonLabel", "status", "entitlementStartedAt");

ALTER TABLE "SeasonPassMatchFinalization"
ADD COLUMN "postMatchCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SeasonPassMatchFinalization"
ADD CONSTRAINT "SeasonPassMatchFinalization_postMatchCount_check"
CHECK ("postMatchCount" >= 0);
