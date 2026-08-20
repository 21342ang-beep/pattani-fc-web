import "server-only";

import { randomUUID } from "node:crypto";

/**
 * Every flow that can hold more than one barcode row must acquire them in the
 * same order. This avoids mover-vs-mover deadlocks while the gate scanner holds
 * a single barcode row with FOR UPDATE.
 */
export function orderSeasonPassBarcodeLockIds(
  ids: readonly (string | null | undefined)[],
): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
}

/**
 * Retire the credential incarnation before a barcode leaves an assignment.
 * The human barcode remains unchanged for display/sequence purposes.
 */
export function rotateSeasonPassGateCredential() {
  return {
    gateVersion: { increment: 1 },
    gateNonce: randomUUID(),
    legacyGateAllowed: false,
  } as const;
}

/** New assignments must never turn the legacy transition back on. */
export function secureSeasonPassGateAssignment() {
  return { legacyGateAllowed: false } as const;
}
