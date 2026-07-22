export const STADIUM_ZONES = {
  A1: { label: "อัฒจันทร์เหนือ · A1", priceSatang: 17_000 },
  A2: { label: "อัฒจันทร์เหนือ · A2", priceSatang: 15_000 },
  B: { label: "อัฒจันทร์ฝั่งตะวันออก · B", priceSatang: 10_000 },
  C: { label: "อัฒจันทร์ใต้ฝั่งตะวันออก · C", priceSatang: 12_000 },
  D: { label: "อัฒจันทร์ใต้ · D", priceSatang: 15_000 },
  E: { label: "อัฒจันทร์ใต้ฝั่งตะวันตก · E", priceSatang: 12_000 },
  G: { label: "อัฒจันทร์ฝั่งตะวันตก · G", priceSatang: 10_000 },
  AWAY: { label: "ทีมเยือน", priceSatang: 20_000 },
} as const;

export type StadiumZoneCode = keyof typeof STADIUM_ZONES;

export type ZonePriceGroup = 200 | 170 | 150 | 120 | 100;

export function getZonePriceGroup(code: StadiumZoneCode): ZonePriceGroup | null {
  const priceBaht = STADIUM_ZONES[code].priceSatang / 100;
  return priceBaht === 200 || priceBaht === 170 || priceBaht === 150 || priceBaht === 120 || priceBaht === 100
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
