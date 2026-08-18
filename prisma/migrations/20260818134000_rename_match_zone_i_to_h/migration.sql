-- Correct the public stadium zone code from I to H without renaming the
-- legacy Match capacity/price columns. Abort instead of merging data if a
-- custom H zone or an H label already exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "MatchTicketZone" WHERE "code" = 'H') THEN
    RAISE EXCEPTION 'Cannot rename fixed zone I to H: a custom MatchTicketZone H already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "MatchZoneLabel" AS legacy
    JOIN "MatchZoneLabel" AS corrected
      ON corrected."matchId" = legacy."matchId"
     AND corrected."code" = 'H'
    WHERE legacy."code" = 'I'
  ) THEN
    RAISE EXCEPTION 'Cannot rename fixed zone I to H: both labels exist for the same match';
  END IF;
END $$;

UPDATE "MatchZoneLabel"
SET
  "code" = 'H',
  "label" = CASE
    WHEN "label" = 'ZONE I' THEN 'ZONE H'
    WHEN "label" = 'Zone I' THEN 'Zone H'
    WHEN "label" = 'โซน I' THEN 'โซน H'
    WHEN "label" = 'อัฒจันทร์ฝั่งตะวันตก · I' THEN 'อัฒจันทร์ฝั่งตะวันตก · H'
    ELSE "label"
  END
WHERE "code" = 'I';

UPDATE "Booking"
SET "zone" = 'H'
WHERE "zone" = 'I';
