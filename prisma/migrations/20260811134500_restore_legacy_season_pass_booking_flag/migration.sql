-- Keep the previous boolean during rolling deploys and rollbacks. New code uses
-- seasonPassSalePhase, but the old PM2 workers may still read this column until reload.
ALTER TABLE "TicketPurchaseSetting"
ADD COLUMN IF NOT EXISTS "seasonPassBookingOpen" BOOLEAN NOT NULL DEFAULT false;

UPDATE "TicketPurchaseSetting"
SET "seasonPassBookingOpen" = ("seasonPassSalePhase" = 'PUBLIC_OPEN');
