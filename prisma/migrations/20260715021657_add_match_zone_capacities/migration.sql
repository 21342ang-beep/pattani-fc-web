-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "zone" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "zone100Seats" INTEGER,
ADD COLUMN     "zone120Seats" INTEGER,
ADD COLUMN     "zone150Seats" INTEGER,
ADD COLUMN     "zone170Seats" INTEGER;

-- CreateIndex
CREATE INDEX "Booking_matchId_zone_idx" ON "Booking"("matchId", "zone");
