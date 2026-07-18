CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'CUP');

ALTER TABLE "Match"
ADD COLUMN "competitionType" "CompetitionType" NOT NULL DEFAULT 'LEAGUE';
