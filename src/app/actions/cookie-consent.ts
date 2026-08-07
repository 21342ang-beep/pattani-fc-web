"use server";

import { cookies } from "next/headers";
import {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VALUES,
  type CookieConsentValue,
} from "@/lib/cookie-consent";

export async function saveCookieConsent(
  value: string,
): Promise<{ ok: boolean }> {
  if (!COOKIE_CONSENT_VALUES.includes(value as CookieConsentValue)) {
    return { ok: false };
  }

  const store = await cookies();
  store.set(COOKIE_CONSENT_NAME, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "low",
  });

  return { ok: true };
}
