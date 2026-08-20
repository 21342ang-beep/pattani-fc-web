import "server-only";

import { getClientIp } from "@/lib/rate-limit";
import {
  isValidRegistrationTurnstileResult,
  type TurnstileVerificationResult,
} from "@/lib/turnstile-policy";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function configuration() {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  return siteKey && secretKey ? { siteKey, secretKey } : null;
}

function allowedHostnames(): ReadonlySet<string> {
  const configured = process.env.TURNSTILE_ALLOWED_HOSTNAMES
    ?.split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  return new Set(
    configured?.length
      ? configured
      : process.env.NODE_ENV === "production"
        ? ["pattanifc.co", "www.pattanifc.co"]
        : ["localhost", "127.0.0.1"],
  );
}

export function getTurnstileSiteKey(): string | null {
  return configuration()?.siteKey ?? null;
}

export async function verifyRegistrationTurnstile(
  token: FormDataEntryValue | null,
): Promise<boolean> {
  const config = configuration();
  // Development may run without Cloudflare, but production must never silently
  // lose its bot challenge because an environment variable was omitted.
  if (!config) return process.env.NODE_ENV !== "production";
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
    const result = (await response.json().catch(() => null)) as
      | TurnstileVerificationResult
      | null;
    return (
      response.ok &&
      isValidRegistrationTurnstileResult(result, allowedHostnames())
    );
  } catch {
    return false;
  }
}
