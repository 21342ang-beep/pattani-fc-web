import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { deriveSecurityKey } from "@/lib/security-keys";

const ISSUER = "pattani-fc";
const AUDIENCE = "season-pass-barcode";
const TOKEN_TTL_SECONDS = 5 * 60;

export type SeasonPassBarcodeAccessBinding = {
  barcodeId: string;
  barcode: string;
  gateVersion: number;
  gateNonce: string;
  orderId: string | null;
};

function accessKey(purpose: "jwt" | "assignment"): Uint8Array {
  const dedicatedSecret = process.env.SEASON_BARCODE_ACCESS_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !dedicatedSecret) {
    throw new Error("SEASON_BARCODE_ACCESS_SECRET is required in production");
  }
  return deriveSecurityKey(
    `pattani-fc/season-pass-barcode-access/v3/${purpose}`,
    dedicatedSecret,
  );
}

function assignmentFingerprint(
  binding: SeasonPassBarcodeAccessBinding,
): string {
  // The nonce is the Gate bearer credential. Keep it out of the signed JWT
  // payload/query string and bind the short-lived renderer URL to an opaque,
  // domain-separated HMAC instead.
  return createHmac("sha256", accessKey("assignment"))
    .update("season-pass-barcode-assignment\0")
    .update(
      JSON.stringify([
        binding.barcodeId,
        binding.barcode,
        binding.gateVersion,
        binding.gateNonce,
        binding.orderId,
      ]),
    )
    .digest("base64url");
}

function fingerprintMatches(
  supplied: unknown,
  binding: SeasonPassBarcodeAccessBinding,
): boolean {
  if (typeof supplied !== "string") return false;
  try {
    const actual = Buffer.from(supplied, "base64url");
    const expected = Buffer.from(assignmentFingerprint(binding), "base64url");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

export async function createSeasonPassBarcodeAccessToken(
  binding: SeasonPassBarcodeAccessBinding,
): Promise<string> {
  return new SignJWT({
    kind: "season-pass-barcode-v3",
    assignment: assignmentFingerprint(binding),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(accessKey("jwt"));
}

export async function verifySeasonPassBarcodeAccessToken(
  token: string | null,
  expected: SeasonPassBarcodeAccessBinding,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, accessKey("jwt"), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return (
      payload.kind === "season-pass-barcode-v3" &&
      fingerprintMatches(payload.assignment, expected)
    );
  } catch {
    return false;
  }
}
