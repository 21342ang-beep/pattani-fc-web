import { createHmac, timingSafeEqual } from "node:crypto";

export type BeamPaymentReference =
  | { kind: "booking"; code: string }
  | { kind: "season"; code: string };

export function verifyBeamSignature(
  rawBody: Uint8Array,
  signature: string | null,
  encodedHmacKey: string | undefined,
) {
  if (!signature || !encodedHmacKey) return false;

  try {
    const key = Buffer.from(encodedHmacKey, "base64");
    const received = Buffer.from(signature, "base64");
    if (key.length === 0 || received.length === 0) return false;

    const expected = createHmac("sha256", key).update(rawBody).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

export function parseBeamPaymentReference(referenceId: string): BeamPaymentReference | null {
  const booking = /^booking_([a-z0-9]{8,50})(?:_[a-z0-9-]{8,})?$/i.exec(referenceId);
  if (booking) return { kind: "booking", code: booking[1] };

  const season = /^season_([a-z0-9-]{8,100})(?:_[a-z0-9]{8,})?$/i.exec(referenceId);
  if (season) return { kind: "season", code: season[1] };

  return null;
}
