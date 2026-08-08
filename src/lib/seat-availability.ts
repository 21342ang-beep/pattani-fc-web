import "server-only";

import type { Match } from "@prisma/client";
import { activeBookingStatusWhere, expirePendingBookings } from "@/lib/booking-expiry";
import { prisma } from "@/lib/prisma";
import {
  getZoneCapacity,
  getZoneCapacityScope,
  STADIUM_ZONE_CODES,
  type StadiumZoneCode,
} from "@/lib/stadium-zones";

type MatchForAvailability = Pick<
  Match,
  | "id"
  | "homeTeam"
  | "competitionType"
  | "zoneASeats"
  | "zoneBSeats"
  | "zoneCSeats"
  | "zoneDSeats"
  | "zoneESeats"
  | "zoneFSeats"
  | "zoneGSeats"
  | "zoneISeats"
  | "zoneJSeats"
  | "zone170Seats"
  | "zone150Seats"
  | "zone120Seats"
  | "zone100Seats"
  | "zoneAwaySeats"
>;

export type ZoneAvailability = {
  code: StadiumZoneCode;
  capacity: number | null;
  matchBooked: number;
  seasonReserved: number;
  remaining: number;
  sharedCapacity: boolean;
  poolKey: string;
};

export type AggregatedZoneAvailability = Omit<ZoneAvailability, "poolKey">;

export function calculateMatchAvailability(
  match: MatchForAvailability,
  bookings: { zone: string | null; quantity: number }[],
) {
  return Object.fromEntries(
    STADIUM_ZONE_CODES.map((code) => {
      const scope = getZoneCapacityScope(match, code);
      const capacity = getZoneCapacity(match, code);
      const matchBooked = bookings.reduce(
        (sum, booking) => booking.zone && scope.includes(booking.zone as StadiumZoneCode)
          ? sum + booking.quantity
          : sum,
        0,
      );
      const remaining = capacity == null
        ? 0
        : Math.max(0, capacity - matchBooked);
      const value: ZoneAvailability = {
        code,
        capacity,
        matchBooked,
        seasonReserved: 0,
        remaining,
        sharedCapacity: scope.length > 1,
        poolKey: scope.length > 1 ? `shared:${scope.join("-")}` : `zone:${code}`,
      };
      return [code, value];
    }),
  ) as Record<StadiumZoneCode, ZoneAvailability>;
}

export async function getSeatAvailabilityForMatches(matches: MatchForAvailability[]) {
  if (matches.length === 0) {
    return new Map<string, Record<StadiumZoneCode, ZoneAvailability>>();
  }

  const matchIds = matches.map((match) => match.id);
  await expirePendingBookings({ matchIds });

  const bookingGroups = await prisma.booking.groupBy({
    by: ["matchId", "zone"],
    where: {
      matchId: { in: matchIds },
      ...activeBookingStatusWhere(),
    },
    _sum: { quantity: true },
  });

  return new Map(matches.map((match) => {
    const bookings = bookingGroups
      .filter((group) => group.matchId === match.id)
      .map((group) => ({ zone: group.zone, quantity: group._sum.quantity ?? 0 }));
    return [match.id, calculateMatchAvailability(match, bookings)];
  }));
}

export function aggregateZoneAvailability(
  availabilityByMatch: ReadonlyMap<string, Record<StadiumZoneCode, ZoneAvailability>>,
) {
  return Object.fromEntries(STADIUM_ZONE_CODES.map((code) => {
    const values = [...availabilityByMatch.values()].map((availability) => availability[code]);
    const configured = values.filter((value) => value.capacity != null);
    const value: AggregatedZoneAvailability = {
      code,
      capacity: configured.length > 0
        ? configured.reduce((sum, item) => sum + (item.capacity ?? 0), 0)
        : null,
      matchBooked: values.reduce((sum, item) => sum + item.matchBooked, 0),
      seasonReserved: values.reduce((sum, item) => sum + item.seasonReserved, 0),
      remaining: values.reduce((sum, item) => sum + item.remaining, 0),
      sharedCapacity: values.some((item) => item.sharedCapacity),
    };
    return [code, value];
  })) as Record<StadiumZoneCode, AggregatedZoneAvailability>;
}

export function summarizeSeatAvailability(
  availabilityByMatch: ReadonlyMap<string, Record<StadiumZoneCode, ZoneAvailability>>,
) {
  let capacity = 0;
  let matchBooked = 0;
  let seasonReserved = 0;
  let remaining = 0;
  for (const [matchId, zones] of availabilityByMatch) {
    const seenPools = new Set<string>();
    for (const code of STADIUM_ZONE_CODES) {
      const zone = zones[code];
      const poolId = `${matchId}:${zone.poolKey}`;
      if (seenPools.has(poolId) || zone.capacity == null) continue;
      seenPools.add(poolId);
      capacity += zone.capacity;
      matchBooked += zone.matchBooked;
      seasonReserved += zone.seasonReserved;
      remaining += zone.remaining;
    }
  }
  return { capacity, matchBooked, seasonReserved, remaining };
}
