CREATE TYPE "SeasonPassSalesChannel" AS ENUM ('ONLINE', 'OFFLINE', 'INTERNAL');

ALTER TABLE "SeasonPassOrder"
ADD COLUMN "salesChannel" "SeasonPassSalesChannel" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "seatNumber" TEXT,
ADD COLUMN "offlineReceiptNo" TEXT,
ADD COLUMN "soldAt" TIMESTAMP(3),
ADD COLUMN "soldById" TEXT;

CREATE INDEX "SeasonPassOrder_salesChannel_idx" ON "SeasonPassOrder"("salesChannel");
CREATE UNIQUE INDEX "SeasonPassOrder_seasonLabel_seatZone_seatNumber_key" ON "SeasonPassOrder"("seasonLabel", "seatZone", "seatNumber");
