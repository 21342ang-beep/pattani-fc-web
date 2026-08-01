ALTER TABLE "Match"
ADD COLUMN "zoneASeats" INTEGER,
ADD COLUMN "zoneBSeats" INTEGER,
ADD COLUMN "zoneCSeats" INTEGER,
ADD COLUMN "zoneDSeats" INTEGER,
ADD COLUMN "zoneESeats" INTEGER,
ADD COLUMN "zoneFSeats" INTEGER,
ADD COLUMN "zoneGSeats" INTEGER,
ADD COLUMN "zoneISeats" INTEGER,
ADD COLUMN "zoneJSeats" INTEGER;

-- Existing grouped capacities remain untouched. The application keeps using
-- those shared pools until an admin enters exact capacities for every zone.
