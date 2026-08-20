-- Payload uses its own PostgreSQL schema and is not described by Prisma's
-- model graph. Existing installations therefore need an explicit, additive
-- role migration before the RBAC-aware application code starts.
DO $payload_rbac$
BEGIN
  IF to_regclass('payload.cms_users') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'payload' AND t.typname = 'enum_cms_users_role'
    ) THEN
      EXECUTE 'CREATE TYPE payload.enum_cms_users_role AS ENUM (''super-admin'', ''editor'', ''accountant'')';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'payload'
        AND table_name = 'cms_users'
        AND column_name = 'role'
    ) THEN
      EXECUTE 'ALTER TABLE payload.cms_users
        ADD COLUMN role payload.enum_cms_users_role NOT NULL DEFAULT ''editor''';
    END IF;
  END IF;
END
$payload_rbac$;

-- Case-insensitive duplicate verified emails make legacy ticket ownership
-- ambiguous. Remove only those fallback links; customerId remains authoritative
-- for every unambiguous or newly authenticated purchase.
WITH ambiguous_verified_emails AS (
  SELECT lower(trim("email")) AS normalized_email
  FROM "Customer"
  WHERE "emailVerifiedAt" IS NOT NULL
  GROUP BY lower(trim("email"))
  HAVING count(*) > 1
)
UPDATE "Booking" AS booking
SET "customerId" = NULL
FROM ambiguous_verified_emails AS ambiguous
WHERE lower(trim(booking."customerEmail")) = ambiguous.normalized_email;

-- Prevent creating another ambiguous verified owner after the migration. If an
-- installation already has duplicates, leave them for the explicit recovery
-- workflow above rather than making deploy fail after an earlier migration has
-- committed.
DO $verified_email_index$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Customer"
    WHERE "emailVerifiedAt" IS NOT NULL
    GROUP BY lower(trim("email"))
    HAVING count(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "Customer_verified_email_normalized_key"
      ON "Customer" (lower(trim("email")))
      WHERE "emailVerifiedAt" IS NOT NULL';
  END IF;
END
$verified_email_index$;

-- A provider payment must authorize exactly one business object. Application
-- checks remain defense in depth, while these constraints prevent malformed
-- rows from bypassing ownership/amount reconciliation through another code
-- path or a future maintenance script.
ALTER TABLE "BeamPayment"
  ADD CONSTRAINT "BeamPayment_exactly_one_target_check"
  CHECK (num_nonnulls("bookingId", "seasonPassOrderId", "seasonPassPurchaseId") = 1);

ALTER TABLE "XenditPayment"
  ADD CONSTRAINT "XenditPayment_exactly_one_target_check"
  CHECK (num_nonnulls("bookingId", "seasonPassOrderId", "seasonPassPurchaseId") = 1);
