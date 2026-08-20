import "server-only";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { deriveSecurityKey } from "@/lib/security-keys";
import type { BookingAccessClaim } from "@/lib/booking-access-policy";

function signingKey() {
  return deriveSecurityKey(
    "pattani-fc/booking-access/v1",
    process.env.BOOKING_ACCESS_SECRET,
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseClaim(payload: JWTPayload): BookingAccessClaim | null {
  if (payload.kind === "booking-direct") {
    if (
      typeof payload.bookingId !== "string" ||
      typeof payload.bookingCode !== "string" ||
      !isNullableString(payload.customerId)
    ) {
      return null;
    }
    return {
      kind: "booking-direct",
      bookingId: payload.bookingId,
      bookingCode: payload.bookingCode,
      customerId: payload.customerId,
    };
  }
  if (payload.kind === "booking-recovery") {
    if (typeof payload.phone !== "string" || !isNullableString(payload.customerId)) {
      return null;
    }
    return {
      kind: "booking-recovery",
      phone: payload.phone,
      customerId: payload.customerId,
    };
  }
  return null;
}

export async function createBookingAccessToken(
  claim: BookingAccessClaim,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT(claim)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pattani-fc")
    .setAudience("booking-access")
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(signingKey());
}

export async function verifyBookingAccessToken(
  token: string | undefined,
): Promise<BookingAccessClaim | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer: "pattani-fc",
      audience: "booking-access",
    });
    return parseClaim(payload);
  } catch {
    return null;
  }
}
