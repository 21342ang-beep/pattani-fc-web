ALTER TABLE "SeasonPassOrder"
ADD COLUMN "seatZone" TEXT;

UPDATE "SeasonPassOrder"
SET "seatZone" = 'UNSPECIFIED'
WHERE "seatZone" IS NULL;

ALTER TABLE "SeasonPassOrder"
ALTER COLUMN "seatZone" SET NOT NULL;
