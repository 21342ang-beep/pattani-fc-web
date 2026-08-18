ALTER TABLE "MatchTicketZone"
ADD COLUMN "buttonLabel" TEXT;

UPDATE "MatchTicketZone"
SET "buttonLabel" = CASE
  WHEN UPPER("code") LIKE '%VVIP%' OR UPPER("name") LIKE '%VVIP%' THEN 'V'
  WHEN UPPER("code") ~ '-[A-Z]$' THEN RIGHT(UPPER("code"), 1)
  WHEN UPPER("code") ~ '^[A-Z]$' THEN UPPER("code")
  ELSE NULL
END;

ALTER TABLE "MatchTicketZone"
ADD CONSTRAINT "MatchTicketZone_buttonLabel_check"
CHECK ("buttonLabel" IS NULL OR "buttonLabel" ~ '^[A-Z]$');
