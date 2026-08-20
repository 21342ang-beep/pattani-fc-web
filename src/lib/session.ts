import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { deriveSecurityKey } from "@/lib/security-keys";
import { hasValidLegacySessionTimes } from "@/lib/legacy-session-policy";

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 ชั่วโมง

const encodedKey = deriveSecurityKey(
  "pattani-fc/admin-session/v1",
  process.env.ADMIN_SESSION_SECRET,
);

function legacySessionWindowOpen(): boolean {
  const cutoff = Date.parse(process.env.LEGACY_SESSION_ACCEPT_UNTIL ?? "");
  return Number.isFinite(cutoff) && Date.now() <= cutoff;
}

async function decryptLegacyAdminSession(
  token: string,
): Promise<SessionPayload | null> {
  if (!legacySessionWindowOpen()) return null;
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    // The former admin token had no kind/issuer/audience. Keeping those checks
    // exact prevents a token from another trust domain being accepted here.
    if (
      payload.kind !== undefined ||
      payload.iss !== undefined ||
      payload.aud !== undefined ||
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string" ||
      !hasValidLegacySessionTimes(payload, SESSION_TTL_MS / 1000)
    ) {
      return null;
    }
    return { ...payload, kind: "admin" } as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export interface SessionPayload {
  userId: string;
  role: string;
  authVersion?: number;
  kind: "admin";
  expiresAt: number;
  iat?: number;
  [key: string]: unknown;
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pattani-fc")
    .setAudience("admin-session")
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(encodedKey);
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
      issuer: "pattani-fc",
      audience: "admin-session",
    });
    const authVersion = payload.authVersion;
    if (
      payload.kind !== "admin" ||
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string" ||
      (authVersion === undefined && !legacySessionWindowOpen()) ||
      (authVersion !== undefined &&
        (typeof authVersion !== "number" ||
          !Number.isInteger(authVersion) ||
          authVersion < 0)) ||
      !hasValidLegacySessionTimes(payload, SESSION_TTL_MS / 1000)
    ) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return decryptLegacyAdminSession(token);
  }
}

export async function createSession(
  userId: string,
  role: string,
  authVersion: number,
): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = await encrypt({ userId, role, authVersion, kind: "admin", expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt),
    priority: "high",
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decrypt(store.get(SESSION_COOKIE)?.value);
}
