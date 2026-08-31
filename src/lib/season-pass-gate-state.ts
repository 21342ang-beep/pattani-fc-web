import "server-only";

import { randomUUID } from "node:crypto";

const PRINTED_PFC26_BARCODE_PATTERN =
  /^PFC26-(4000|2500|2000|1500)-\d{4}$/;

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

/**
 * Physical 2026/27 cards were printed with the human PFC26 code, not SPG2.
 * Enable that input only for the known printed inventory format. Other barcode
 * formats remain SPG2-only, and rotateSeasonPassGateCredential disables the
 * physical credential again whenever a card leaves an assignment.
 */
export function secureSeasonPassGateAssignment(barcode: string) {
  return {
    legacyGateAllowed: PRINTED_PFC26_BARCODE_PATTERN.test(
      barcode.trim().toUpperCase(),
    ),
  } as const;
}
