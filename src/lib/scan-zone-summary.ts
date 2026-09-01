export const ALL_SCAN_ZONES = "__ALL__";
export const UNASSIGNED_SCAN_ZONE = "__UNASSIGNED__";

export type ScanZoneMetricRow = {
  zone: string | null | undefined;
  scans: number;
  total?: number;
};

export type ScanZoneSummary = {
  zone: string;
  scans: number;
  total: number;
};

export function scanZoneKey(zone: string | null | undefined): string {
  const normalized = zone?.trim();
  return normalized || UNASSIGNED_SCAN_ZONE;
}

export function buildScanZoneSummaries(
  rows: readonly ScanZoneMetricRow[],
  preferredZones: readonly string[] = [],
): ScanZoneSummary[] {
  const summaries = new Map<string, ScanZoneSummary>();

  for (const zone of preferredZones) {
    const key = scanZoneKey(zone);
    if (!summaries.has(key)) summaries.set(key, { zone: key, scans: 0, total: 0 });
  }

  for (const row of rows) {
    const key = scanZoneKey(row.zone);
    const current = summaries.get(key) ?? { zone: key, scans: 0, total: 0 };
    current.scans += row.scans;
    current.total += row.total ?? 0;
    summaries.set(key, current);
  }

  const preferredOrder = new Map(
    preferredZones.map((zone, index) => [scanZoneKey(zone), index]),
  );
  const collator = new Intl.Collator("th", { numeric: true, sensitivity: "base" });

  return [...summaries.values()].sort((left, right) => {
    if (left.zone === UNASSIGNED_SCAN_ZONE) return 1;
    if (right.zone === UNASSIGNED_SCAN_ZONE) return -1;
    const leftOrder = preferredOrder.get(left.zone);
    const rightOrder = preferredOrder.get(right.zone);
    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return collator.compare(left.zone, right.zone);
  });
}

export function resolveSelectedScanZone(
  rawZone: string | null | undefined,
  availableZones: readonly string[],
): string {
  const normalized = rawZone?.trim();
  if (!normalized || normalized === ALL_SCAN_ZONES || normalized.toUpperCase() === "ALL") {
    return ALL_SCAN_ZONES;
  }
  return availableZones.find(
    (zone) => zone.toUpperCase() === normalized.toUpperCase(),
  ) ?? ALL_SCAN_ZONES;
}

export function scanZoneMatches(
  zone: string | null | undefined,
  selectedZone: string,
): boolean {
  return selectedZone === ALL_SCAN_ZONES || scanZoneKey(zone) === selectedZone;
}
