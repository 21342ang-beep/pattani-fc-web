export const STADIUM_ZONES = {
  N1: { label: "เหนือ · พรีเมียม", priceSatang: 17_000 },
  N2: { label: "เหนือ", priceSatang: 15_000 },
  S: { label: "ใต้ · กลางสนาม", priceSatang: 15_000 },
  W: { label: "ตะวันตก", priceSatang: 10_000 },
  E: { label: "ตะวันออก", priceSatang: 10_000 },
  S1: { label: "ใต้-ตะวันตก", priceSatang: 12_000 },
  S2: { label: "ใต้-ตะวันออก", priceSatang: 12_000 },
  AWAY: { label: "ทีมเยือน", priceSatang: 20_000 },
} as const;

export type StadiumZoneCode = keyof typeof STADIUM_ZONES;

export type ZonePriceGroup = 170 | 150 | 120 | 100;

export function getZonePriceGroup(code: StadiumZoneCode): ZonePriceGroup | null {
  const priceBaht = STADIUM_ZONES[code].priceSatang / 100;
  return priceBaht === 170 || priceBaht === 150 || priceBaht === 120 || priceBaht === 100
    ? priceBaht
    : null;
}

export function getZonesForPriceGroup(group: ZonePriceGroup): StadiumZoneCode[] {
  return (Object.keys(STADIUM_ZONES) as StadiumZoneCode[]).filter(
    (code) => getZonePriceGroup(code) === group
  );
}

export function getZoneCapacity(
  match: {
    zone170Seats: number | null;
    zone150Seats: number | null;
    zone120Seats: number | null;
    zone100Seats: number | null;
    zoneAwaySeats: number | null;
  },
  code: StadiumZoneCode
) {
  const group = getZonePriceGroup(code);
  if (group === 170) return match.zone170Seats;
  if (group === 150) return match.zone150Seats;
  if (group === 120) return match.zone120Seats;
  if (group === 100) return match.zone100Seats;
  if (code === "AWAY") return match.zoneAwaySeats;
  return null;
}

export function getStadiumZone(code: string | null | undefined) {
  return code && code in STADIUM_ZONES
    ? STADIUM_ZONES[code as StadiumZoneCode]
    : null;
}
