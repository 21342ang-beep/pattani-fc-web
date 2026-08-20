import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import {
  getLegacyUpgradeTimes,
  hasValidLegacySessionTimes,
} from "@/lib/legacy-session-policy";

// Proxy (Next.js 16: เดิมชื่อ middleware) — optimistic check จาก cookie
// การตรวจจริงทำใน DAL อีกชั้นที่ data source
//
// หมายเหตุ: import dynamic ของ jose แทน decrypt ใน lib เพราะ proxy ทำงานใน
// edge runtime ที่ห้าม `import "server-only"`

const ADMIN_PREFIX = "/admin";
const MEMBER_PREFIX = "/member";
const LOGIN_PATH = "/login";
const MEMBER_LOGIN_PATH = "/member/login";
const MEMBER_FORGOT_PASSWORD_PATH = "/member/forgot-password";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const CUSTOMER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const PUBLIC_MEMBER_PATHS = new Set([
  MEMBER_LOGIN_PATH,
  MEMBER_FORGOT_PASSWORD_PATH,
]);

type SessionRow = {
  kind?: string;
  role?: string;
  exp?: number;
  iat?: number;
  expiresAt?: number;
  [k: string]: unknown;
};
type SessionVerification = {
  payload: SessionRow;
  upgradedToken?: string;
};

const encoder = new TextEncoder();

async function deriveProxyKey(
  purpose: string,
  dedicatedSecret?: string,
): Promise<Uint8Array | null> {
  const root = dedicatedSecret?.trim() || process.env.SESSION_SECRET?.trim();
  if (!root || encoder.encode(root).byteLength < 32) return null;
  const material = encoder.encode(`${purpose}\0${root}`);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}

function legacySessionCutoffSeconds(): number | null {
  const cutoff = Date.parse(process.env.LEGACY_SESSION_ACCEPT_UNTIL ?? "");
  if (!Number.isFinite(cutoff) || Date.now() > cutoff) return null;
  return Math.floor(cutoff / 1000);
}

async function verifyStrict(
  token: string,
  purpose: string,
  dedicatedSecret: string | undefined,
  audience: string,
  maxTtlSeconds: number,
): Promise<SessionRow | null> {
  const key = await deriveProxyKey(purpose, dedicatedSecret);
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: "pattani-fc",
      audience,
    });
    return hasValidLegacySessionTimes(payload, maxTtlSeconds)
      ? (payload as SessionRow)
      : null;
  } catch {
    return null;
  }
}

async function verifyLegacy(
  token: string,
  maxTtlSeconds: number,
): Promise<SessionRow | null> {
  if (legacySessionCutoffSeconds() === null) return null;
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || encoder.encode(secret).byteLength < 32) return null;
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ["HS256"],
    });
    if (
      payload.iss !== undefined ||
      payload.aud !== undefined ||
      !hasValidLegacySessionTimes(payload, maxTtlSeconds)
    ) return null;
    return payload as SessionRow;
  } catch {
    return null;
  }
}

async function upgradeLegacyToken(
  legacy: SessionRow,
  kind: "admin" | "customer",
  purpose: string,
  dedicatedSecret: string | undefined,
  audience: string,
  maxTtlSeconds: number,
): Promise<{ token: string; expiration: number } | undefined> {
  const cutoff = legacySessionCutoffSeconds();
  if (!cutoff) return undefined;
  const times = getLegacyUpgradeTimes(legacy, maxTtlSeconds, cutoff);
  if (!times) return undefined;
  const key = await deriveProxyKey(purpose, dedicatedSecret);
  if (!key) return undefined;
  const { iat: _iat, exp: _exp, nbf: _nbf, iss: _iss, aud: _aud, ...claims } =
    legacy;
  const token = await new SignJWT({
    ...claims,
    kind,
    expiresAt: times.expiration * 1000,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pattani-fc")
    .setAudience(audience)
    // Preserve the original issuance time so password/role changes that
    // revoked the legacy admin token cannot be bypassed by this upgrade.
    .setIssuedAt(times.issuedAt)
    .setExpirationTime(times.expiration)
    .sign(key);
  return { token, expiration: times.expiration };
}

async function verifyAdminSession(
  token: string | undefined,
): Promise<SessionVerification | null> {
  if (!token) return null;
  const current = await verifyStrict(
    token,
    "pattani-fc/admin-session/v1",
    process.env.ADMIN_SESSION_SECRET,
    "admin-session",
    ADMIN_SESSION_TTL_SECONDS,
  );
  if (current?.kind === "admin" && typeof current.role === "string") {
    return { payload: current };
  }
  const legacy = await verifyLegacy(token, ADMIN_SESSION_TTL_SECONDS);
  if (
    legacy?.kind !== undefined ||
    typeof legacy?.userId !== "string" ||
    typeof legacy.role !== "string"
  ) {
    return null;
  }
  const upgrade = await upgradeLegacyToken(
      legacy,
      "admin",
      "pattani-fc/admin-session/v1",
      process.env.ADMIN_SESSION_SECRET,
      "admin-session",
      ADMIN_SESSION_TTL_SECONDS,
    );
  return {
    payload: {
      ...legacy,
      kind: "admin",
      ...(upgrade
        ? { exp: upgrade.expiration, expiresAt: upgrade.expiration * 1000 }
        : {}),
    },
    upgradedToken: upgrade?.token,
  };
}

async function verifyCustomerSession(
  token: string | undefined,
): Promise<SessionVerification | null> {
  if (!token) return null;
  const current = await verifyStrict(
    token,
    "pattani-fc/customer-session/v1",
    process.env.CUSTOMER_SESSION_SECRET,
    "customer-session",
    CUSTOMER_SESSION_TTL_SECONDS,
  );
  if (current?.kind === "customer") return { payload: current };
  const legacy = await verifyLegacy(token, CUSTOMER_SESSION_TTL_SECONDS);
  if (
    legacy?.kind !== "customer" ||
    typeof legacy.customerId !== "string" ||
    typeof legacy.email !== "string"
  ) {
    return null;
  }
  const upgrade = await upgradeLegacyToken(
      legacy,
      "customer",
      "pattani-fc/customer-session/v1",
      process.env.CUSTOMER_SESSION_SECRET,
      "customer-session",
      CUSTOMER_SESSION_TTL_SECONDS,
    );
  return {
    payload: upgrade
      ? { ...legacy, exp: upgrade.expiration, expiresAt: upgrade.expiration * 1000 }
      : legacy,
    upgradedToken: upgrade?.token,
  };
}

function attachSessionUpgrades(
  response: NextResponse,
  admin: SessionVerification | null,
  customer: SessionVerification | null,
): NextResponse {
  if (admin?.upgradedToken && typeof admin.payload.exp === "number") {
    response.cookies.set("session", admin.upgradedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: new Date(admin.payload.exp * 1000),
      priority: "high",
    });
  }
  if (customer?.upgradedToken && typeof customer.payload.exp === "number") {
    response.cookies.set("customer_session", customer.upgradedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(customer.payload.exp * 1000),
    });
  }
  return response;
}

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const adminSession = await verifyAdminSession(req.cookies.get("session")?.value);
  const inspectCustomer =
    path === "/" ||
    path.startsWith(MEMBER_PREFIX) ||
    path.startsWith("/checkout") ||
    path.startsWith("/tickets");
  const customerSession = inspectCustomer
    ? await verifyCustomerSession(req.cookies.get("customer_session")?.value)
    : null;
  const isAdmin =
    adminSession?.payload.role === "ADMIN" ||
    adminSession?.payload.role === "SUPER_ADMIN";

  // /member ต้องเป็น customer เท่านั้น
  if (path.startsWith(MEMBER_PREFIX) && !PUBLIC_MEMBER_PATHS.has(path)) {
    const isCustomer = customerSession?.payload.kind === "customer";
    if (!isCustomer) {
      return attachSessionUpgrades(
        NextResponse.redirect(new URL(MEMBER_LOGIN_PATH, req.nextUrl)),
        adminSession,
        customerSession,
      );
    }
  }

  // /admin — admin only
  if (path.startsWith(ADMIN_PREFIX) && !isAdmin) {
    return attachSessionUpgrades(
      NextResponse.redirect(new URL(LOGIN_PATH, req.nextUrl)),
      adminSession,
      customerSession,
    );
  }
  // reauth=1 ใช้เมื่อ DAL พบว่าบัญชี/รหัสผ่าน/สิทธิ์ถูกแก้ไขหลังออก JWT
  // ต้องยอมให้เห็นหน้า login เพื่อออก session ใหม่ ไม่เช่นนั้นจะ redirect loop
  if (path === LOGIN_PATH && isAdmin && req.nextUrl.searchParams.get("reauth") !== "1") {
    return attachSessionUpgrades(
      NextResponse.redirect(new URL(ADMIN_PREFIX, req.nextUrl)),
      adminSession,
      customerSession,
    );
  }
  return attachSessionUpgrades(
    NextResponse.next(),
    adminSession,
    customerSession,
  );
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/login",
    "/member/:path*",
    "/checkout/:path*",
    "/tickets/:path*",
  ],
};
