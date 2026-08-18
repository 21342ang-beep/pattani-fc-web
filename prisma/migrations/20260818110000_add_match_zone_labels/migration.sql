CREATE TABLE "MatchZoneLabel" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchZoneLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchZoneLabel_matchId_code_key"
ON "MatchZoneLabel"("matchId", "code");

CREATE INDEX "MatchZoneLabel_matchId_idx"
ON "MatchZoneLabel"("matchId");

ALTER TABLE "MatchZoneLabel"
ADD CONSTRAINT "MatchZoneLabel_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
