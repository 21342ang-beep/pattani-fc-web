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

export type SeasonPassZoneBarcodeBounds = {
  seatZone: string;
  lowerBound: string;
  upperBound: string;
  publicSeatCount: number;
};

/**
 * Resolves the public barcode interval owned by one zone. A null result means
 * the package does not have a complete zone allocation, so callers must not
 * guess a zone from a package-wide barcode sequence.
 */
export function getSeasonPassZoneBarcodeBounds(
  barcodePrefix: string,
  orderedSeatZones: readonly string[],
  quotas: readonly SeasonPassZoneQuotaInput[],
  seatZone: string,
): SeasonPassZoneBarcodeBounds | null {
  const range = calculateSeasonPassZoneRanges(orderedSeatZones, quotas).find(
    (item) => item.seatZone === seatZone,
  );
  if (!range) return null;

  return {
    seatZone,
    lowerBound: `${barcodePrefix}${formatSeasonPassSequence(range.publicStartSequence)}`,
    upperBound: `${barcodePrefix}${formatSeasonPassSequence(range.publicEndSequence)}`,
    publicSeatCount: range.publicSeatCount,
  };
}

export function seasonPassBarcodeIsWithinBounds(
  barcode: string,
  bounds: SeasonPassZoneBarcodeBounds,
): boolean {
  return (
    bounds.publicSeatCount > 0 &&
    barcode >= bounds.lowerBound &&
    barcode <= bounds.upperBound
  );
}
