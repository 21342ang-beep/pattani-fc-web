export type SeasonPassZoneQuotaInput = {
  seatZone: string;
  totalSeats: number;
  sponsorReserved: number;
};

const FIXED_SEASON_PASS_BARCODE_QUOTAS: Readonly<
  Record<string, readonly SeasonPassZoneQuotaInput[]>
> = {
  // These 160 VVIP barcodes have already been printed and assigned in two
  // stable blocks. VVIP is not managed by SeasonPassZoneQuota, so keep this
  // physical numbering rule here instead of guessing from missing DB rows.
  "2026/27:vvip-elite:PFC26-4000-": [
    { seatZone: "VVIP-A", totalSeats: 80, sponsorReserved: 0 },
    { seatZone: "VVIP-B", totalSeats: 80, sponsorReserved: 0 },
  ],
};

export function resolveSeasonPassBarcodeZoneQuotas(
  seasonLabel: string,
  tierId: string,
  barcodePrefix: string,
  orderedSeatZones: readonly string[],
  configuredQuotas: readonly SeasonPassZoneQuotaInput[],
): SeasonPassZoneQuotaInput[] {
  const fixedQuotas =
    FIXED_SEASON_PASS_BARCODE_QUOTAS[
      `${seasonLabel}:${tierId}:${barcodePrefix}`
    ];
  if (
    fixedQuotas?.length === orderedSeatZones.length &&
    fixedQuotas.every((quota, index) => quota.seatZone === orderedSeatZones[index])
  ) {
    return fixedQuotas.map((quota) => ({ ...quota }));
  }

  const quotaByZone = new Map(
    configuredQuotas.map((quota) => [quota.seatZone, quota]),
  );
  if (orderedSeatZones.some((seatZone) => !quotaByZone.has(seatZone))) return [];
  return orderedSeatZones.map((seatZone) => ({ ...quotaByZone.get(seatZone)! }));
}

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
