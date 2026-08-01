export type SeasonPassZoneQuotaInput = {
  seatZone: string;
  totalSeats: number;
  sponsorReserved: number;
};

export type SeasonPassZoneRange = SeasonPassZoneQuotaInput & {
  startSequence: number;
  endSequence: number;
  publicStartSequence: number;
  publicEndSequence: number;
  publicSeatCount: number;
};

export function calculateSeasonPassZoneRanges(
  orderedSeatZones: readonly string[],
  quotas: readonly SeasonPassZoneQuotaInput[],
): SeasonPassZoneRange[] {
  const quotaByZone = new Map(quotas.map((quota) => [quota.seatZone, quota]));
  if (orderedSeatZones.some((seatZone) => !quotaByZone.has(seatZone))) return [];

  let nextSequence = 1;
  return orderedSeatZones.map((seatZone) => {
    const quota = quotaByZone.get(seatZone)!;
    const totalSeats = Math.max(0, quota.totalSeats);
    const sponsorReserved = Math.min(totalSeats, Math.max(0, quota.sponsorReserved));
    const startSequence = nextSequence;
    const endSequence = startSequence + totalSeats - 1;
    const publicSeatCount = totalSeats - sponsorReserved;
    const publicEndSequence = startSequence + publicSeatCount - 1;
    nextSequence = endSequence + 1;

    return {
      seatZone,
      totalSeats,
      sponsorReserved,
      startSequence,
      endSequence,
      publicStartSequence: startSequence,
      publicEndSequence,
      publicSeatCount,
    };
  });
}

export function formatSeasonPassSequence(sequence: number) {
  return String(sequence).padStart(4, "0");
}
