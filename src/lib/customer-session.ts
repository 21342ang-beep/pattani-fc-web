import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { deriveSecurityKey } from "@/lib/security-keys";
import { hasValidLegacySessionTimes } from "@/lib/legacy-session-policy";

// Customer session — แยกจาก admin (cookie คนละชื่อ, kind ใน JWT payload)
// ถ้าใครสลับ token ของอีกฝั่งมาใช้ จะ verify ผ่านแต่ check kind ไม่ผ่าน → reject

const CUSTOMER_COOKIE = "customer_session";
const CUSTOMER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 วัน

const encodedKey = deriveSecurityKey(
  "pattani-fc/customer-session/v1",
  process.env.CUSTOMER_SESSION_SECRET,
);

function legacySessionWindowOpen(): boolean {
  const cutoff = Date.parse(process.env.LEGACY_SESSION_ACCEPT_UNTIL ?? "");
  return Number.isFinite(cutoff) && Date.now() <= cutoff;
}

async function decryptLegacyCustomerSession(
  token: string,
): Promise<CustomerSessionPayload | null> {
  if (!legacySessionWindowOpen()) return null;
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (
      payload.kind !== "customer" ||
      payload.iss !== undefined ||
      payload.aud !== undefined ||
      typeof payload.customerId !== "string" ||
      typeof payload.email !== "string" ||
      !hasValidLegacySessionTimes(payload, CUSTOMER_TTL_MS / 1000)
    ) {
      return null;
    }
    return payload as unknown as CustomerSessionPayload;
  } catch {
    return null;
  }
}

export interface CustomerSessionPayload {
  customerId: string;
  email: string;
  name: string;
  authVersion?: number;
  kind: "customer";
  expiresAt: number;
  [key: string]: unknown;
}

async function encrypt(payload: CustomerSessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pattani-fc")
    .setAudience("customer-session")
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(encodedKey);
}

async function decrypt(
  token: string | undefined
): Promise<CustomerSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
      issuer: "pattani-fc",
      audience: "customer-session",
    });
    if (
      payload.kind !== "customer" ||
      typeof payload.customerId !== "string" ||
      typeof payload.email !== "string" ||
      (payload.authVersion !== undefined &&
        (typeof payload.authVersion !== "number" ||
          !Number.isSafeInteger(payload.authVersion) ||
          payload.authVersion < 0)) ||
      !hasValidLegacySessionTimes(payload, CUSTOMER_TTL_MS / 1000)
    ) {
      return null;
    }
    return payload as unknown as CustomerSessionPayload;
  } catch {
    return decryptLegacyCustomerSession(token);
  }
}

export async function createCustomerSession(
  customerId: string,
  email: string,
  name: string,
  expectedAuthVersion?: number,
): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { authVersion: true },
  });
  if (!customer) throw new Error("Customer session owner not found");
  if (
    expectedAuthVersion !== undefined &&
    customer.authVersion !== expectedAuthVersion
  ) {
    throw new Error("Customer security state changed");
  }
  const expiresAt = Date.now() + CUSTOMER_TTL_MS;
  const token = await encrypt({
    customerId,
    email,
    name,
    authVersion: expectedAuthVersion ?? customer.authVersion,
    kind: "customer",
    expiresAt,
  });
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function isCustomerSessionCurrent(
  session: CustomerSessionPayload,
  authVersion: number,
): boolean {
  // Legacy sessions are version zero so deployment does not log out every
  // member. A credential change increments the DB value and revokes them.
  return (session.authVersion ?? 0) === authVersion;
}

export async function deleteCustomerSession(): Promise<void> {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
}

export async function readCustomerSession(): Promise<CustomerSessionPayload | null> {
  const store = await cookies();
  return decrypt(store.get(CUSTOMER_COOKIE)?.value);
}
