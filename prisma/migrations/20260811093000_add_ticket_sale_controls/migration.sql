ALTER TABLE "TicketPurchaseSetting"
ADD COLUMN "leagueBookingOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "seasonPassBookingOpen" BOOLEAN NOT NULL DEFAULT false;
