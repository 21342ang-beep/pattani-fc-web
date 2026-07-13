CREATE TABLE "SeasonPassBarcode" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "usesRemaining" INTEGER NOT NULL DEFAULT 15,
    "orderId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonPassBarcode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonPassScan" (
    "id" TEXT NOT NULL,
    "barcodeId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedBy" TEXT NOT NULL,
    CONSTRAINT "SeasonPassScan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonPassBarcode_barcode_key" ON "SeasonPassBarcode"("barcode");
CREATE UNIQUE INDEX "SeasonPassBarcode_orderId_key" ON "SeasonPassBarcode"("orderId");
CREATE INDEX "SeasonPassBarcode_tierId_orderId_idx" ON "SeasonPassBarcode"("tierId", "orderId");
CREATE UNIQUE INDEX "SeasonPassScan_barcodeId_matchId_key" ON "SeasonPassScan"("barcodeId", "matchId");
CREATE INDEX "SeasonPassScan_matchId_idx" ON "SeasonPassScan"("matchId");

ALTER TABLE "SeasonPassBarcode" ADD CONSTRAINT "SeasonPassBarcode_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "SeasonPassOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeasonPassScan" ADD CONSTRAINT "SeasonPassScan_barcodeId_fkey"
  FOREIGN KEY ("barcodeId") REFERENCES "SeasonPassBarcode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPassScan" ADD CONSTRAINT "SeasonPassScan_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SeasonPassBarcode" ("id", "barcode", "tierId", "seasonLabel")
SELECT 'spb-vvip-' || lpad(n::text, 4, '0'), 'PFC26-4000-' || lpad(n::text, 4, '0'), 'vvip-elite', '2026/27'
FROM generate_series(1, 160) AS n;
INSERT INTO "SeasonPassBarcode" ("id", "barcode", "tierId", "seasonLabel")
SELECT 'spb-vip-' || lpad(n::text, 4, '0'), 'PFC26-2500-' || lpad(n::text, 4, '0'), 'vip-advanced', '2026/27'
FROM generate_series(1, 386) AS n;
INSERT INTO "SeasonPassBarcode" ("id", "barcode", "tierId", "seasonLabel")
SELECT 'spb-premium-' || lpad(n::text, 4, '0'), 'PFC26-2000-' || lpad(n::text, 4, '0'), 'premium', '2026/27'
FROM generate_series(1, 1000) AS n;
INSERT INTO "SeasonPassBarcode" ("id", "barcode", "tierId", "seasonLabel")
SELECT 'spb-gold-' || lpad(n::text, 4, '0'), 'PFC26-1500-' || lpad(n::text, 4, '0'), 'gold', '2026/27'
FROM generate_series(1, 500) AS n;

-- Preserve codes already issued to customers while consuming one stock record per order.
WITH orders AS (
  SELECT id, "passCode", "tierId", row_number() OVER (PARTITION BY "tierId" ORDER BY "createdAt", id) AS n
  FROM "SeasonPassOrder"
), stock AS (
  SELECT id, "tierId", row_number() OVER (PARTITION BY "tierId" ORDER BY id) AS n
  FROM "SeasonPassBarcode"
)
UPDATE "SeasonPassBarcode" b
SET "barcode" = o."passCode", "orderId" = o.id, "assignedAt" = CURRENT_TIMESTAMP
FROM orders o JOIN stock s ON s."tierId" = o."tierId" AND s.n = o.n
WHERE b.id = s.id;
