import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  bookingSearchPhoneVariants,
  normalizeBookingSearchPhone,
} from "@/lib/booking-search-otp";
import { uniqueVerifiedPhoneRecoveryOwner } from "@/lib/customer-registration-policy";

export type VerifiedPhoneClaimResult =
  | "verified"
  | "already_verified"
  | "conflict"
  | "not_applicable";

function normalizedThaiMobile(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = normalizeBookingSearchPhone(phone);
  return /^0[689]\d{8}$/.test(normalized) ? normalized : null;
}

function phoneMatchSql(phone: string) {
  const [domesticPhone, internationalPhone] = bookingSearchPhoneVariants(phone);
  return Prisma.sql`(
    regexp_replace(coalesce("phone", ''), '\\D', '', 'g') = ${domesticPhone}
    OR regexp_replace(coalesce("phone", ''), '\\D', '', 'g') = ${internationalPhone}
  )`;
}

/**
 * Returns at most two owners. Two rows are enough to prove that the phone does
 * not have a unique verified owner without exposing any customer details.
 */
export async function getVerifiedPhoneOwnerIds(phone: string): Promise<string[]> {
  const normalizedPhone = normalizedThaiMobile(phone);
  if (!normalizedPhone) return [];

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "Customer"
    WHERE "phoneVerifiedAt" IS NOT NULL
      AND ${phoneMatchSql(normalizedPhone)}
    ORDER BY "phoneVerifiedAt" ASC, "id" ASC
    LIMIT 2
  `);
  return rows.map(({ id }) => id);
}

/**
 * Claims a verified phone for one customer. The advisory lock serializes OTP
 * completions for the same phone so two accounts cannot claim it concurrently.
 */
export async function claimVerifiedPhoneForCustomer(
  customerId: string,
  phone: string,
): Promise<VerifiedPhoneClaimResult> {
  const normalizedPhone = normalizedThaiMobile(phone);
  if (!normalizedPhone) return "not_applicable";

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-phone:${normalizedPhone}`}))`,
    );

    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { id: true, phone: true, phoneVerifiedAt: true },
    });
    if (normalizedThaiMobile(customer?.phone) !== normalizedPhone) {
      return "not_applicable";
    }

    const otherVerifiedOwners = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Customer"
      WHERE "id" <> ${customerId}
        AND "phoneVerifiedAt" IS NOT NULL
        AND ${phoneMatchSql(normalizedPhone)}
      LIMIT 1
    `);
    if (otherVerifiedOwners.length > 0) return "conflict";
    if (customer?.phoneVerifiedAt) return "already_verified";

    await tx.customer.update({
      where: { id: customerId },
      data: { phoneVerifiedAt: new Date() },
    });
    return "verified";
  });
}

/**
 * Password reset may use only a phone that the account proved previously.
 * Merely typing a phone during registration is not ownership proof: numbers
 * are mistyped and recycled, so issuing a reset for an unverified value could
 * hand the account to the current SIM owner.
 */
export async function findPasswordResetCustomerId(
  phone: string,
): Promise<string | null> {
  const normalizedPhone = normalizedThaiMobile(phone);
  if (!normalizedPhone) return null;

  const verifiedOwners = await getVerifiedPhoneOwnerIds(normalizedPhone);
  return uniqueVerifiedPhoneRecoveryOwner(verifiedOwners);
}
