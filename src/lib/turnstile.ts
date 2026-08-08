import "server-only";

import { getClientIp } from "@/lib/rate-limit";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function configuration() {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  return siteKey && secretKey ? { siteKey, secretKey } : null;
}

export function getTurnstileSiteKey(): string | null {
  return configuration()?.siteKey ?? null;
}

export async function verifyRegistrationTurnstile(
  token: FormDataEntryValue | null,
): Promise<boolean> {
  const config = configuration();
  // Safe rollout: production registration keeps working until both keys exist.
  if (!config) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) {
    return false;
  }

  const body = new URLSearchParams({
    secret: config.secretKey,
    response: token,
  });
  const ip = await getClientIp();
  if (ip !== "unknown") body.set("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json().catch(() => null)) as {
      success?: boolean;
      action?: string;
    } | null;
    return response.ok && result?.success === true && result.action === "register";
  } catch {
    return false;
  }
}
