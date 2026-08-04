export const STADIUM_ZONES = {
  A: { label: "อัฒจันทร์เหนือ · A" },
  B: { label: "อัฒจันทร์เหนือ · B" },
  C: { label: "อัฒจันทร์ฝั่งตะวันออก · C" },
  D: { label: "อัฒจันทร์ฝั่งตะวันออก · D" },
  E: { label: "อัฒจันทร์ใต้ · E" },
  F: { label: "อัฒจันทร์ใต้ · F" },
  G: { label: "อัฒจันทร์ใต้ · G" },
  I: { label: "อัฒจันทร์ฝั่งตะวันตก · I" },
  J: { label: "อัฒจันทร์ฝั่งตะวันตก · J" },
  AWAY: { label: "ทีมเยือน" },
} as const;

export type StadiumZoneCode = keyof typeof STADIUM_ZONES;
export const STADIUM_ZONE_CODES = Object.keys(STADIUM_ZONES) as StadiumZoneCode[];

export const MATCH_ZONE_CAPACITY_FIELDS = {
  A: "zoneASeats",
  B: "zoneBSeats",
  C: "zoneCSeats",
  D: "zoneDSeats",
  E: "zoneESeats",
  F: "zoneFSeats",
  G: "zoneGSeats",
  I: "zoneISeats",
  J: "zoneJSeats",
  AWAY: "zoneAwaySeats",
} as const satisfies Record<StadiumZoneCode, string>;

export const MATCH_ZONE_PRICE_FIELDS = {
  A: "zoneAPrice",
  B: "zoneBPrice",
  C: "zoneCPrice",
  D: "zoneDPrice",
  E: "zoneEPrice",
  F: "zoneFPrice",
  G: "zoneGPrice",
  I: "zoneIPrice",
  J: "zoneJPrice",
  AWAY: "zoneAwayPrice",
} as const satisfies Record<StadiumZoneCode, string>;

export type MatchZoneCapacityField = (typeof MATCH_ZONE_CAPACITY_FIELDS)[StadiumZoneCode];
export type MatchZonePriceField = (typeof MATCH_ZONE_PRICE_FIELDS)[StadiumZoneCode];
export type ZonePriceGroup = 200 | 170 | 150 | 120 | 100;

export type MatchCapacity = Record<MatchZoneCapacityField, number | null> & {
  zone170Seats: number | null;
  zone150Seats: number | null;
  zone120Seats: number | null;
  zone100Seats: number | null;
};

export type MatchZonePrices = Record<MatchZonePriceField, number | null>;

const LEGACY_ZONE_PRICE_GROUPS: Record<StadiumZoneCode, ZonePriceGroup> = {
  A: 150,
  B: 150,
  C: 120,
  D: 100,
  E: 120,
  F: 150,
  G: 120,
  I: 100,
  J: 120,
  AWAY: 200,
};

export function getZonePriceGroup(code: StadiumZoneCode): ZonePriceGroup | null {
  return LEGACY_ZONE_PRICE_GROUPS[code] ?? null;
}

export function getZonesForPriceGroup(group: ZonePriceGroup): StadiumZoneCode[] {
  return STADIUM_ZONE_CODES.filter((code) => getZonePriceGroup(code) === group);
}

function getLegacyZoneCapacity(match: MatchCapacity, code: StadiumZoneCode) {
  const group = getZonePriceGroup(code);
  if (group === 170) return match.zone170Seats;
  if (group === 150) return match.zone150Seats;
  if (group === 120) return match.zone120Seats;
  if (group === 100) return match.zone100Seats;
  return code === "AWAY" ? match.zoneAwaySeats : null;
}

export function getExactZoneCapacity(match: MatchCapacity, code: StadiumZoneCode) {
  return match[MATCH_ZONE_CAPACITY_FIELDS[code]];
}

export function getZoneCapacity(match: MatchCapacity, code: StadiumZoneCode) {
  return getExactZoneCapacity(match, code) ?? getLegacyZoneCapacity(match, code);
}

export function getZonePrice(match: MatchZonePrices, code: StadiumZoneCode) {
  return match[MATCH_ZONE_PRICE_FIELDS[code]];
}

export function getZoneCapacityScope(match: MatchCapacity, code: StadiumZoneCode) {
  if (getExactZoneCapacity(match, code) != null || code === "AWAY") return [code];
  const group = getZonePriceGroup(code);
  return group == null ? [code] : getZonesForPriceGroup(group);
}

export function hasAllExactZoneCapacities(match: MatchCapacity) {
  return STADIUM_ZONE_CODES.every((code) => getExactZoneCapacity(match, code) != null);
}

export function getStadiumZone(code: string | null | undefined) {
  return code && code in STADIUM_ZONES
    ? STADIUM_ZONES[code as StadiumZoneCode]
    : null;
}
