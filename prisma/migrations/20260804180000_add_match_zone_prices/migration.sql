ALTER TABLE "Match"
ADD COLUMN "zoneAPrice" INTEGER,
ADD COLUMN "zoneBPrice" INTEGER,
ADD COLUMN "zoneCPrice" INTEGER,
ADD COLUMN "zoneDPrice" INTEGER,
ADD COLUMN "zoneEPrice" INTEGER,
ADD COLUMN "zoneFPrice" INTEGER,
ADD COLUMN "zoneGPrice" INTEGER,
ADD COLUMN "zoneIPrice" INTEGER,
ADD COLUMN "zoneJPrice" INTEGER,
ADD COLUMN "zoneAwayPrice" INTEGER;

-- Preserve the prices customers saw before prices became configurable per match.
UPDATE "Match"
SET
  "zoneAPrice" = 15000,
  "zoneBPrice" = 15000,
  "zoneCPrice" = 12000,
  "zoneDPrice" = 10000,
  "zoneEPrice" = 12000,
  "zoneFPrice" = 15000,
  "zoneGPrice" = 12000,
  "zoneIPrice" = 10000,
  "zoneJPrice" = 12000,
  "zoneAwayPrice" = 20000,
  "pricePerSeat" = 10000;
