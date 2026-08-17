CREATE TABLE "MatchTicketZone" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchTicketZone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchTicketZone_matchId_code_key"
ON "MatchTicketZone"("matchId", "code");

CREATE INDEX "MatchTicketZone_matchId_isActive_sortOrder_idx"
ON "MatchTicketZone"("matchId", "isActive", "sortOrder");

ALTER TABLE "MatchTicketZone"
ADD CONSTRAINT "MatchTicketZone_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
