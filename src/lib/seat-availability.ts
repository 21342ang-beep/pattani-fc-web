import "server-only";

import type { Match } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SEASON_LABEL } from "@/lib/season-pass-tiers";
import { isPattaniHomeTeam } from "@/lib/season-pass-home-match";
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

export function seasonPassSeatZoneToMatchZone(seatZone: string): StadiumZoneCode | null {
  const suffix = seatZone.trim().toUpperCase().split("-").at(-1);
  return suffix && STADIUM_ZONE_CODES.includes(suffix as StadiumZoneCode)
    ? (suffix as StadiumZoneCode)
    : null;
}

export function matchUsesSeasonPassCapacity(match: Pick<Match, "homeTeam" | "competitionType">) {
  return match.competitionType === "LEAGUE" && isPattaniHomeTeam(match.homeTeam);
}

export function calculateMatchAvailability(
  match: MatchForAvailability,
  bookings: { zone: string | null; quantity: number }[],
  seasonReservations: ReadonlyMap<StadiumZoneCode, number>,
) {
  const usesSeasonPasses = matchUsesSeasonPassCapacity(match);
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
      const seasonReserved = usesSeasonPasses
        ? scope.reduce((sum, zone) => sum + (seasonReservations.get(zone) ?? 0), 0)
        : 0;
      const remaining = capacity == null
        ? 0
        : Math.max(0, capacity - matchBooked - seasonReserved);
      const value: ZoneAvailability = {
        code,
        capacity,
        matchBooked,
        seasonReserved,
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

  const [bookingGroups, seasonGroups] = await Promise.all([
    prisma.booking.groupBy({
      by: ["matchId", "zone"],
      where: {
        matchId: { in: matches.map((match) => match.id) },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _sum: { quantity: true },
    }),
    prisma.seasonPassOrder.groupBy({
      by: ["seatZone"],
      where: {
        seasonLabel: SEASON_LABEL,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _count: { _all: true },
    }),
  ]);

  const seasonReservations = new Map<StadiumZoneCode, number>();
  for (const group of seasonGroups) {
    const code = seasonPassSeatZoneToMatchZone(group.seatZone);
    if (code) seasonReservations.set(code, (seasonReservations.get(code) ?? 0) + group._count._all);
  }

  return new Map(matches.map((match) => {
    const bookings = bookingGroups
      .filter((group) => group.matchId === match.id)
      .map((group) => ({ zone: group.zone, quantity: group._sum.quantity ?? 0 }));
    return [match.id, calculateMatchAvailability(match, bookings, seasonReservations)];
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
