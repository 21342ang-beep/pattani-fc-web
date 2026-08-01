export const STADIUM_ZONES = {
  A: { label: "อัฒจันทร์เหนือ · A", priceSatang: 15_000 },
  B: { label: "อัฒจันทร์เหนือ · B", priceSatang: 15_000 },
  C: { label: "อัฒจันทร์ฝั่งตะวันออก · C", priceSatang: 12_000 },
  D: { label: "อัฒจันทร์ฝั่งตะวันออก · D", priceSatang: 10_000 },
  E: { label: "อัฒจันทร์ใต้ · E", priceSatang: 12_000 },
  F: { label: "อัฒจันทร์ใต้ · F", priceSatang: 15_000 },
  G: { label: "อัฒจันทร์ใต้ · G", priceSatang: 12_000 },
  I: { label: "อัฒจันทร์ฝั่งตะวันตก · I", priceSatang: 10_000 },
  J: { label: "อัฒจันทร์ฝั่งตะวันตก · J", priceSatang: 12_000 },
  AWAY: { label: "ทีมเยือน", priceSatang: 20_000 },
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

export type MatchZoneCapacityField = (typeof MATCH_ZONE_CAPACITY_FIELDS)[StadiumZoneCode];
export type ZonePriceGroup = 200 | 170 | 150 | 120 | 100;

export type MatchCapacity = Record<MatchZoneCapacityField, number | null> & {
  zone170Seats: number | null;
  zone150Seats: number | null;
  zone120Seats: number | null;
  zone100Seats: number | null;
};

export function getZonePriceGroup(code: StadiumZoneCode): ZonePriceGroup | null {
  const priceBaht = STADIUM_ZONES[code].priceSatang / 100;
  return priceBaht === 200 || priceBaht === 170 || priceBaht === 150 || priceBaht === 120 || priceBaht === 100
    ? priceBaht
    : null;
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
