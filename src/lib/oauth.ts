import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { AuthProvider } from "@prisma/client";

// helper กลางสำหรับ OAuth (Google + Line)
// - build redirect URI จาก NEXT_PUBLIC_APP_URL
// - sign state JWT (cookie) กัน CSRF และเก็บ intent (register/login)

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET ต้องตั้งค่าใน .env.local");
}
const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET);

const STATE_COOKIE_PREFIX = "oauth_state:";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 นาที

export type OAuthIntent = "register" | "login";

// ข้อมูลที่ลูกค้ากรอกในฟอร์มสมัคร (flow "กรอกก่อน แล้วผูก social")
// เก็บไว้ใน state JWT (httpOnly cookie, signed, TTL 10 นาที) จนกว่าจะกลับจาก provider
// passwordHash = bcrypt แล้ว — ไม่เคยเก็บ plaintext ใน cookie
// email = อีเมลที่ "กรอก" (อาจถูก override ด้วยอีเมล verified ของ provider ตอน callback)
export type OAuthPendingProfile = {
  name: string;
  email: string;
  phone: string | null;
  gender: string;
  birthDate: string;
  address: string;
  province: string;
  district: string;
  postalCode: string;
  passwordHash: string;
};

export type OAuthState = {
  provider: AuthProvider;
  intent: OAuthIntent;
  pdpaConsent: boolean;
  nonce: string;
  expiresAt: number;
  profile?: OAuthPendingProfile;
  returnTo?: string;
};

export function getSafeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/season-pass/apply?") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export function requireAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) {
    throw new Error("NEXT_PUBLIC_APP_URL ต้องตั้งค่า (เช่น http://localhost:3000)");
  }
  // trim space + strip trailing path/slash — กัน typo กรณีคนใส่ callback path มาด้วย
  try {
    const parsed = new URL(raw.trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return raw.trim().replace(/\/+$/, "");
  }
}

export function buildRedirectUri(provider: AuthProvider): string {
  return `${requireAppUrl()}/api/auth/${provider.toLowerCase()}/callback`;
}

async function signState(payload: OAuthState): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(secretKey);
}

async function verifyState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.provider !== "string" ||
      typeof payload.intent !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }
    return payload as unknown as OAuthState;
  } catch {
    return null;
  }
}

// สร้าง state + set cookie — return random string ที่ต้องส่งไป provider
export async function createOAuthState(
  provider: AuthProvider,
  intent: OAuthIntent,
  pdpaConsent: boolean,
  profile?: OAuthPendingProfile,
  returnTo?: string | null,
): Promise<string> {
  const nonce = crypto.randomUUID();
  const expiresAt = Date.now() + STATE_TTL_MS;
  const safeReturnTo = getSafeReturnTo(returnTo);
  const token = await signState({
    provider,
    intent,
    pdpaConsent,
    nonce,
    expiresAt,
    ...(profile ? { profile } : {}),
    ...(safeReturnTo ? { returnTo: safeReturnTo } : {}),
  });
  const store = await cookies();
  store.set(STATE_COOKIE_PREFIX + provider, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });
  return nonce;
}

// callback: อ่าน + verify state cookie แล้วเช็ค nonce ตรงกับ state ที่ provider ส่งกลับ
export async function consumeOAuthState(
  provider: AuthProvider,
  incomingState: string,
): Promise<OAuthState | null> {
  const store = await cookies();
  const key = STATE_COOKIE_PREFIX + provider;
  const token = store.get(key)?.value;
  if (!token) return null;
  store.delete(key);
  const state = await verifyState(token);
  if (!state) return null;
  if (state.nonce !== incomingState) return null;
  if (state.provider !== provider) return null;
  if (Date.now() > state.expiresAt) return null;
  return state;
}

// URL ปลายทางเมื่อ login/register สำเร็จ
// notice = โน้ตให้หน้าแสดง banner (เช่น อีเมลถูกยึดตาม provider)
export function successRedirectUrl(
  notice?: string,
  returnTo?: string,
  fallbackPath = "/member",
): URL {
  const url = new URL(getSafeReturnTo(returnTo) ?? fallbackPath, requireAppUrl());
  if (notice) url.searchParams.set("notice", notice);
  return url;
}

export function errorRedirectUrl(
  intent: OAuthIntent,
  code: string,
): URL {
  const path = intent === "register" ? "/register" : "/member/login";
  const url = new URL(path, requireAppUrl());
  url.searchParams.set("error", code);
  return url;
}
