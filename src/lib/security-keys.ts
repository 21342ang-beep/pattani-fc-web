import "server-only";

import { createHash } from "node:crypto";

/**
 * Derive independent 256-bit keys for each trust domain. A token from the
 * customer app can therefore never be accepted as an admin or OAuth token,
 * even when deployments use one root secret.
 */
export function deriveSecurityKey(
  purpose: string,
  dedicatedSecret?: string,
): Uint8Array {
  const root = dedicatedSecret?.trim() || process.env.SESSION_SECRET?.trim();
  if (!root || Buffer.byteLength(root, "utf8") < 32) {
    throw new Error("Session secrets must contain at least 32 bytes");
  }
  return createHash("sha256").update(purpose).update("\0").update(root).digest();
}
