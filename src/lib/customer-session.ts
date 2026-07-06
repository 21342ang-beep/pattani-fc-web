import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Customer session — แยกจาก admin (cookie คนละชื่อ, kind ใน JWT payload)
// ถ้าใครสลับ token ของอีกฝั่งมาใช้ จะ verify ผ่านแต่ check kind ไม่ผ่าน → reject

const CUSTOMER_COOKIE = "customer_session";
const CUSTOMER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 วัน

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET ต้องตั้งค่าใน .env.local");
}
const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);

export interface CustomerSessionPayload {
  customerId: string;
  email: string;
  name: string;
  kind: "customer";
  expiresAt: number;
  [key: string]: unknown;
}

async function encrypt(payload: CustomerSessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
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
    });
    if (
      payload.kind !== "customer" ||
      typeof payload.customerId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return payload as unknown as CustomerSessionPayload;
  } catch {
    return null;
  }
}

export async function createCustomerSession(
  customerId: string,
  email: string,
  name: string
): Promise<void> {
  const expiresAt = Date.now() + CUSTOMER_TTL_MS;
  const token = await encrypt({
    customerId,
    email,
    name,
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

export async function deleteCustomerSession(): Promise<void> {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
}

export async function readCustomerSession(): Promise<CustomerSessionPayload | null> {
  const store = await cookies();
  return decrypt(store.get(CUSTOMER_COOKIE)?.value);
}
