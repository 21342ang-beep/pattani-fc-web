-- Password registrations stay outside Customer until the applicant proves
-- control of the Thai mobile number. This prevents unusable recovery accounts
-- and ensures no authenticated session can exist before OTP completion.
CREATE TABLE "CustomerRegistrationChallenge" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "gender" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3) NOT NULL,
  "address" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "pdpaConsentAt" TIMESTAMP(3) NOT NULL,
  "providerToken" TEXT NOT NULL,
  "reference" TEXT,
  "returnTo" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "customerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerRegistrationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerRegistrationChallenge_customerId_key"
  ON "CustomerRegistrationChallenge"("customerId");
CREATE INDEX "CustomerRegistrationChallenge_email_idx"
  ON "CustomerRegistrationChallenge"("email");
CREATE INDEX "CustomerRegistrationChallenge_phone_idx"
  ON "CustomerRegistrationChallenge"("phone");
CREATE INDEX "CustomerRegistrationChallenge_expiresAt_idx"
  ON "CustomerRegistrationChallenge"("expiresAt");

ALTER TABLE "CustomerRegistrationChallenge"
  ADD CONSTRAINT "CustomerRegistrationChallenge_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
