ALTER TABLE "MatchTicketZone"
DROP CONSTRAINT IF EXISTS "MatchTicketZone_buttonLabel_check";

ALTER TABLE "MatchTicketZone"
ADD CONSTRAINT "MatchTicketZone_buttonLabel_check"
CHECK (
  "buttonLabel" IS NULL
  OR (
    char_length("buttonLabel") BETWEEN 1 AND 12
    AND "buttonLabel" = btrim("buttonLabel")
    AND "buttonLabel" = upper("buttonLabel")
    AND "buttonLabel" !~ '[[:cntrl:]]'
  )
);
