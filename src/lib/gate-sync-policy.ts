export type GateWriteOutcome =
  | { kind: "accepted" }
  | { kind: "conflict"; serverScannedAt: Date }
  | { kind: "unknown" };

/**
 * Only the conditional database write can declare a scan accepted. A stale
 * pre-read must never do so because another gate may win the write race.
 */
export function resolveGateWriteOutcome(
  updatedCount: number,
  serverScannedAt: Date | null | undefined,
): GateWriteOutcome {
  if (updatedCount === 1) return { kind: "accepted" };
  if (serverScannedAt instanceof Date) {
    return { kind: "conflict", serverScannedAt };
  }
  return { kind: "unknown" };
}

export const GATE_LOCAL_SCAN_ID_PATTERN = /^[a-f0-9]{32}$/;
export const GATE_SCAN_MAX_AGE_MS = 9 * 60 * 60 * 1000;
export const GATE_SCAN_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type GateAdmissionCandidate = {
  scanId: string;
  admissionNumber: number;
};

export type GateAdmissionPlan = {
  accepted: string[];
  duplicates: string[];
  conflicts: string[];
  finalCount: number;
};

/**
 * Allocate the implicit per-booking admission slots while the booking row is
 * locked by the caller. Admission numbers make an offline retry idempotent:
 * if another gate already consumed slot N, slot N is a duplicate rather than
 * another use. A gap is never filled silently because it indicates a stale or
 * malformed offline batch.
 */
export function planGateAdmissionSync(
  quantity: number,
  existingCount: number,
  candidates: GateAdmissionCandidate[],
): GateAdmissionPlan {
  let currentCount = Math.max(0, Math.trunc(existingCount));
  const accepted: string[] = [];
  const duplicates: string[] = [];
  const conflicts: string[] = [];
  const seenScanIds = new Set<string>();

  const ordered = [...candidates].sort(
    (a, b) =>
      a.admissionNumber - b.admissionNumber || a.scanId.localeCompare(b.scanId),
  );

  for (const candidate of ordered) {
    if (seenScanIds.has(candidate.scanId)) {
      duplicates.push(candidate.scanId);
      continue;
    }
    seenScanIds.add(candidate.scanId);

    if (
      !Number.isInteger(candidate.admissionNumber) ||
      candidate.admissionNumber < 1 ||
      candidate.admissionNumber > quantity
    ) {
      conflicts.push(candidate.scanId);
      continue;
    }
    if (candidate.admissionNumber <= currentCount) {
      duplicates.push(candidate.scanId);
      continue;
    }
    if (candidate.admissionNumber !== currentCount + 1) {
      conflicts.push(candidate.scanId);
      continue;
    }

    accepted.push(candidate.scanId);
    currentCount += 1;
  }

  return { accepted, duplicates, conflicts, finalCount: currentCount };
}

export function isGateScanTimestampAcceptable(
  scannedAt: Date,
  now = new Date(),
): boolean {
  const value = scannedAt.getTime();
  const current = now.getTime();
  return (
    Number.isFinite(value) &&
    value >= current - GATE_SCAN_MAX_AGE_MS &&
    value <= current + GATE_SCAN_MAX_CLOCK_SKEW_MS
  );
}
