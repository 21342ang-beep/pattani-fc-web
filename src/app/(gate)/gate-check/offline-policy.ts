export const GATE_OFFLINE_MAX_TTL_MS = 8 * 60 * 60 * 1000;
export const GATE_OFFLINE_REVOKED_COOKIE = "gate_offline_revoked";
export const GATE_CACHE_PREFIX = "gate-check-";

export type GateOfflineSession = {
  id: string;
  expiresAt: number;
};

type SessionBoundRecord = {
  sessionId?: string;
  expiresAt?: number;
};

export type StoredGateSessionBinding = {
  sessionId: string;
  expiresAt: number;
};

export type GateStorageTransition = "reuse" | "clear-legacy" | "clear-session";

const SESSION_ID_PATTERN = /^[a-f0-9]{64}$/;

export function clampGateOfflineExpiry(
  sessionExpiresAt: number,
  now = Date.now(),
): number {
  return Math.min(sessionExpiresAt, now + GATE_OFFLINE_MAX_TTL_MS);
}

export function isGateOfflineSessionValid(
  session: GateOfflineSession,
  now = Date.now(),
): boolean {
  return (
    SESSION_ID_PATTERN.test(session.id) &&
    Number.isFinite(session.expiresAt) &&
    session.expiresAt > now
  );
}

export function isGateRecordUsable(
  record: SessionBoundRecord,
  session: GateOfflineSession,
  now = Date.now(),
): boolean {
  return (
    isGateOfflineSessionValid(session, now) &&
    record.sessionId === session.id &&
    typeof record.expiresAt === "number" &&
    record.expiresAt > now &&
    record.expiresAt <= session.expiresAt
  );
}

export function decideGateStorageTransition(
  previous: StoredGateSessionBinding | undefined,
  session: GateOfflineSession,
  now = Date.now(),
): GateStorageTransition {
  // Unbound v1 records have no trustworthy owner. Never adopt them into a
  // newly authenticated account on a shared gate device.
  if (!previous) return "clear-legacy";
  if (
    previous.sessionId !== session.id ||
    previous.expiresAt <= now ||
    !isGateOfflineSessionValid(session, now)
  ) {
    return "clear-session";
  }
  return "reuse";
}

/**
 * Return the next implicit admission slot for a booking on this device. The
 * local floor includes both synced and unsynced records, so a lost sync
 * response cannot make the same device reissue a slot it already admitted.
 */
export function nextGateAdmissionNumber(
  serverScannedCount: number,
  localAdmissionFloor: number,
  quantity: number,
): number | null {
  if (
    !Number.isInteger(serverScannedCount) ||
    serverScannedCount < 0 ||
    !Number.isInteger(localAdmissionFloor) ||
    localAdmissionFloor < 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return null;
  }
  const next = Math.max(serverScannedCount, localAdmissionFloor) + 1;
  return next <= quantity ? next : null;
}
