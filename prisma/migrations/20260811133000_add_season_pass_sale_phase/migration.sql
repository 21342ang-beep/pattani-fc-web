CREATE TYPE "SeasonPassSalePhase" AS ENUM ('STAFF_ONLY', 'PUBLIC_OPEN', 'CLOSED');

ALTER TABLE "TicketPurchaseSetting"
ADD COLUMN "seasonPassSalePhase" "SeasonPassSalePhase" NOT NULL DEFAULT 'STAFF_ONLY';

UPDATE "TicketPurchaseSetting"
SET "seasonPassSalePhase" = CASE
  WHEN "seasonPassBookingOpen" THEN 'PUBLIC_OPEN'::"SeasonPassSalePhase"
  ELSE 'STAFF_ONLY'::"SeasonPassSalePhase"
END;
