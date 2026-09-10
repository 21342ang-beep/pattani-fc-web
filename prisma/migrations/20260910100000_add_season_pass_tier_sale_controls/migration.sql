ALTER TABLE "TicketPurchaseSetting"
ADD COLUMN "seasonPassVipAdvancedOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "seasonPassPremiumOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "seasonPassGoldOpen" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the current all-packages state when upgrading an open sale.
UPDATE "TicketPurchaseSetting"
SET
  "seasonPassVipAdvancedOpen" = ("seasonPassSalePhase" = 'PUBLIC_OPEN'),
  "seasonPassPremiumOpen" = ("seasonPassSalePhase" = 'PUBLIC_OPEN'),
  "seasonPassGoldOpen" = ("seasonPassSalePhase" = 'PUBLIC_OPEN');
