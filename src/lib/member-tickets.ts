import "server-only";

import { prisma } from "@/lib/prisma";
import {
  bookingSearchPhoneVariants,
  normalizeBookingSearchPhone,
} from "@/lib/booking-search-otp";

type MemberIdentity = {
  id: string;
  email: string;
  phone: string | null;
};

export type MemberTicketIds = {
  bookingIds: string[];
  seasonPassOrderIds: string[];
};

/**
 * Finds purchases owned by the signed-in member. Phone matching is deliberately
 * limited to guest purchases that are not already attached to another account.
 */
export async function getMemberTicketIds(
  customer: MemberIdentity,
): Promise<MemberTicketIds> {
  const [accountBookings, accountSeasonPasses] = await Promise.all([
    prisma.booking.findMany({
      where: {
        customerEmail: { equals: customer.email, mode: "insensitive" },
        status: "CONFIRMED",
      },
      select: { id: true },
    }),
    prisma.seasonPassOrder.findMany({
      where: {
        status: "CONFIRMED",
        OR: [
          { customerId: customer.id },
          { customerEmail: { equals: customer.email, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
  ]);

  const normalizedPhone = customer.phone
    ? normalizeBookingSearchPhone(customer.phone)
    : "";
  if (!/^0[689]\d{8}$/.test(normalizedPhone)) {
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
      WHERE coalesce(trim("customerEmail"), '') = ''
        AND "status" = 'CONFIRMED'
        AND (
          regexp_replace("customerPhone", '\\D', '', 'g') = ${domesticPhone}
          OR regexp_replace("customerPhone", '\\D', '', 'g') = ${internationalPhone}
        )
    `,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "SeasonPassOrder"
      WHERE "customerId" IS NULL
        AND coalesce(trim("customerEmail"), '') = ''
        AND "status" = 'CONFIRMED'
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
