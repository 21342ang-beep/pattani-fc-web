import "server-only";

import { prisma } from "@/lib/prisma";
import {
  bookingSearchPhoneVariants,
  normalizeBookingSearchPhone,
} from "@/lib/booking-search-otp";
import { getVerifiedPhoneOwnerIds } from "@/lib/customer-phone-ownership";
import { getVerifiedEmailOwnerIds } from "@/lib/customer-email-ownership";
import { guestEmailOwnershipClause } from "@/lib/customer-ownership-policy";

type MemberIdentity = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
};

export type MemberTicketIds = {
  bookingIds: string[];
  seasonPassOrderIds: string[];
};

/**
 * Finds purchases owned by the signed-in member. Guest purchases are linked by
 * phone only after OTP verification and only when there is one verified owner.
 */
export async function getMemberTicketIds(
  customer: MemberIdentity,
): Promise<MemberTicketIds> {
  const verifiedEmailOwnerIds = await getVerifiedEmailOwnerIds(customer.email);
  const canClaimGuestEmail =
    customer.emailVerifiedAt !== null &&
    verifiedEmailOwnerIds.length === 1 &&
    verifiedEmailOwnerIds[0] === customer.id;
  const hasConflictingVerifiedEmailOwner =
    verifiedEmailOwnerIds.length > 0 &&
    !verifiedEmailOwnerIds.includes(customer.id);
  const [accountBookings, accountSeasonPasses] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: [
          { customerId: customer.id },
          ...(canClaimGuestEmail
            ? [
                guestEmailOwnershipClause(customer.email),
              ]
            : []),
        ],
      },
      select: { id: true },
    }),
    prisma.seasonPassOrder.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: [
          { customerId: customer.id },
          ...(canClaimGuestEmail
            ? [
                guestEmailOwnershipClause(customer.email),
              ]
            : []),
        ],
      },
      select: { id: true },
    }),
  ]);

  const normalizedPhone = customer.phone
    ? normalizeBookingSearchPhone(customer.phone)
    : "";
  if (!customer.phoneVerifiedAt || !/^0[689]\d{8}$/.test(normalizedPhone)) {
    return {
      bookingIds: accountBookings.map(({ id }) => id),
      seasonPassOrderIds: accountSeasonPasses.map(({ id }) => id),
    };
  }

  const verifiedOwnerIds = await getVerifiedPhoneOwnerIds(normalizedPhone);
  if (verifiedOwnerIds.length !== 1 || verifiedOwnerIds[0] !== customer.id) {
    return {
      bookingIds: accountBookings.map(({ id }) => id),
      seasonPassOrderIds: accountSeasonPasses.map(({ id }) => id),
    };
  }

  const [domesticPhone, internationalPhone] =
    bookingSearchPhoneVariants(normalizedPhone);
  const [guestBookings, guestSeasonPasses] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Booking"
      WHERE "customerId" IS NULL
        AND coalesce(trim("customerEmail"), '') = ''
        AND "status" IN ('PENDING', 'CONFIRMED')
        AND (
          regexp_replace("customerPhone", '\\D', '', 'g') = ${domesticPhone}
          OR regexp_replace("customerPhone", '\\D', '', 'g') = ${internationalPhone}
        )
    `,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "SeasonPassOrder"
      WHERE "customerId" IS NULL
        AND (
          coalesce(trim("customerEmail"), '') = ''
          OR (
            ${!hasConflictingVerifiedEmailOwner}
            AND lower(trim("customerEmail")) = lower(trim(${customer.email}))
          )
        )
        AND "status" IN ('PENDING', 'CONFIRMED')
        AND (
          regexp_replace("customerPhone", '\\D', '', 'g') = ${domesticPhone}
          OR regexp_replace("customerPhone", '\\D', '', 'g') = ${internationalPhone}
        )
    `,
  ]);

  return {
    bookingIds: [
      ...new Set([
        ...accountBookings.map(({ id }) => id),
        ...guestBookings.map(({ id }) => id),
      ]),
    ],
    seasonPassOrderIds: [
      ...new Set([
        ...accountSeasonPasses.map(({ id }) => id),
        ...guestSeasonPasses.map(({ id }) => id),
      ]),
    ],
  };
}
