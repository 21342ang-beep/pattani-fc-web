ALTER TABLE "SeasonPassBarcode"
ADD COLUMN "isGenerated" BOOLEAN NOT NULL DEFAULT false;

-- บาร์โค้ดที่ถูกผูกกับออเดอร์แล้วถือว่าออกใช้งานแล้วเสมอ
UPDATE "SeasonPassBarcode"
SET "isGenerated" = true
WHERE "orderId" IS NOT NULL;

CREATE INDEX "SeasonPassBarcode_tierId_isGenerated_orderId_idx"
ON "SeasonPassBarcode"("tierId", "isGenerated", "orderId");
