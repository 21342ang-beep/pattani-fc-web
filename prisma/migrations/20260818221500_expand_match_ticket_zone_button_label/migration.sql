ALTER TABLE "MatchTicketZone"
DROP CONSTRAINT IF EXISTS "MatchTicketZone_buttonLabel_check";

ALTER TABLE "MatchTicketZone"
ADD CONSTRAINT "MatchTicketZone_buttonLabel_check"
CHECK (
  "buttonLabel" IS NULL
  OR "buttonLabel" ~ '^[A-Z]{1,12}$'
);
