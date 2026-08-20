import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { deriveSecurityKey } from "@/lib/security-keys";

const CURRENT_TOKEN_PREFIX = "SPG2";
const LEGACY_TOKEN_PREFIX = "SPG1";
const HUMAN_CODE_PATTERN =
  /^(PFC26-(4000|2500|2000|1500)-\d{4}|SP-[A-Z]+-[A-Z0-9]{8})$/;
const NONCE_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BARCODE_ROW_ID_PATTERN = /^[a-z0-9-]{3,100}$/i;
const COMPACT_NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const COMPACT_VERSION_PATTERN = /^(0|[1-9a-z][0-9a-z]{0,10})$/;
const MAX_GATE_VERSION = 2_147_483_647;

export type SeasonPassGateCredential =
  | {
      kind: "current";
      gateVersion: number;
      gateNonce: string;
    }
  | { kind: "legacy"; barcode: string };

export type SeasonPassGateCredentialRow = {
  id: string;
  barcode: string;
  gateVersion: number;
  gateNonce: string;
  legacyGateAllowed: boolean;
};

function getLegacyGateKey(): Uint8Array {
  const dedicatedSecret = process.env.SEASON_GATE_TOKEN_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !dedicatedSecret) {
    throw new Error(
      "SEASON_GATE_TOKEN_SECRET is required in production and must remain stable across deploys",
    );
  }
  return deriveSecurityKey(
    "pattani-fc/season-pass-gate/v1",
    dedicatedSecret,
  );
}

function legacySignature(encodedPayload: string): Buffer {
  return createHmac("sha256", getLegacyGateKey())
    .update(`${LEGACY_TOKEN_PREFIX}.${encodedPayload}`)
    .digest();
}

function hasValidLegacySignature(
  encodedPayload: string,
  suppliedSignature: string,
): boolean {
  try {
    const supplied = Buffer.from(suppliedSignature, "base64url");
    const expected = legacySignature(encodedPayload);
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  } catch {
    return false;
  }
}

function compactGateNonce(gateNonce: string): string | null {
  if (!NONCE_PATTERN.test(gateNonce)) return null;
  const bytes = Buffer.from(gateNonce.replaceAll("-", ""), "hex");
  return bytes.length === 16 ? bytes.toString("base64url") : null;
}

function expandGateNonce(compactNonce: string): string | null {
  if (!COMPACT_NONCE_PATTERN.test(compactNonce)) return null;
  try {
    const bytes = Buffer.from(compactNonce, "base64url");
    // Buffer's decoder is permissive. Re-encode to require one canonical
    // 16-byte representation and reject aliases/truncated input fail-closed.
    if (
      bytes.length !== 16 ||
      bytes.toString("base64url") !== compactNonce
    ) {
      return null;
    }
    const hex = bytes.toString("hex");
    const uuid = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
    return NONCE_PATTERN.test(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

export function createSeasonPassGateToken(
  row: Omit<SeasonPassGateCredentialRow, "legacyGateAllowed">,
): string {
  const barcode = row.barcode.trim().toUpperCase();
  if (
    !BARCODE_ROW_ID_PATTERN.test(row.id) ||
    !HUMAN_CODE_PATTERN.test(barcode) ||
    !Number.isSafeInteger(row.gateVersion) ||
    row.gateVersion < 0 ||
    row.gateVersion > MAX_GATE_VERSION ||
    !NONCE_PATTERN.test(row.gateNonce)
  ) {
    throw new Error("Invalid season-pass gate credential state");
  }
  const compactNonce = compactGateNonce(row.gateNonce);
  if (!compactNonce) {
    throw new Error("Invalid season-pass gate credential state");
  }
  return `${CURRENT_TOKEN_PREFIX}.${compactNonce}.${row.gateVersion.toString(36)}`;
}

function verifyCurrentToken(value: string): SeasonPassGateCredential | null {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== CURRENT_TOKEN_PREFIX) return null;
  const [, compactNonce, compactVersion] = parts;
  if (!COMPACT_VERSION_PATTERN.test(compactVersion)) return null;
  const gateNonce = expandGateNonce(compactNonce);
  const gateVersion = Number.parseInt(compactVersion, 36);
  if (
    !gateNonce ||
    !Number.isSafeInteger(gateVersion) ||
    gateVersion < 0 ||
    gateVersion > MAX_GATE_VERSION ||
    gateVersion.toString(36) !== compactVersion
  ) {
    return null;
  }
  return { kind: "current", gateVersion, gateNonce };
}

function verifyLegacyToken(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== LEGACY_TOKEN_PREFIX) return null;
  const [, encoded, suppliedSignature] = parts;
  if (
    !encoded ||
    !suppliedSignature ||
    !hasValidLegacySignature(encoded, suppliedSignature)
  ) {
    return null;
  }
  try {
    const barcode = Buffer.from(encoded, "base64url").toString("utf8");
    return HUMAN_CODE_PATTERN.test(barcode) ? barcode : null;
  } catch {
    return null;
  }
}

/** Test/transition helper for cards printed by the previous SPG1 release. */
export function createLegacySeasonPassGateToken(barcode: string): string {
  const normalized = barcode.trim().toUpperCase();
  if (!HUMAN_CODE_PATTERN.test(normalized)) {
    throw new Error("Invalid season-pass barcode");
  }
  const encoded = Buffer.from(normalized, "utf8").toString("base64url");
  return `${LEGACY_TOKEN_PREFIX}.${encoded}.${legacySignature(encoded).toString("base64url")}`;
}

/**
 * Parse a scanner value. SPG1 and raw human codes are accepted only during an
 * explicit transition; the DB row still has to opt in via legacyGateAllowed.
 */
export function resolveSeasonPassGateCredential(
  value: string,
): SeasonPassGateCredential | null {
  const trimmed = value.trim();
  if (trimmed.startsWith(`${CURRENT_TOKEN_PREFIX}.`)) {
    return verifyCurrentToken(trimmed);
  }

  if (process.env.SEASON_PASS_ACCEPT_LEGACY_GATE_CODES !== "true") {
    return null;
  }
  if (trimmed.startsWith(`${LEGACY_TOKEN_PREFIX}.`)) {
    const barcode = verifyLegacyToken(trimmed);
    return barcode ? { kind: "legacy", barcode } : null;
  }
  const barcode = trimmed.toUpperCase();
  return HUMAN_CODE_PATTERN.test(barcode)
    ? { kind: "legacy", barcode }
    : null;
}

export function seasonPassGateCredentialMatchesRow(
  credential: SeasonPassGateCredential,
  row: SeasonPassGateCredentialRow,
): boolean {
  if (credential.kind === "legacy") {
    return credential.barcode === row.barcode && row.legacyGateAllowed;
  }
  return (
    credential.gateVersion === row.gateVersion &&
    credential.gateNonce === row.gateNonce.toLowerCase()
  );
}
