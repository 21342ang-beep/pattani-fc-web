import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { deriveSecurityKey } from "@/lib/security-keys";

const CLEANUP_INTERVAL_MS = 15 * 60_000;
const CLEANUP_RETENTION_MS = 24 * 60 * 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = new Date(Date.now() - CLEANUP_RETENTION_MS);
    void prisma.securityRateLimit
      .deleteMany({ where: { expiresAt: { lt: cutoff } } })
      .catch(() => undefined);
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  // nginx overwrites X-Real-IP with remote_addr in production. Prefer it over
  // X-Forwarded-For, whose first value may otherwise be supplied by a client.
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const forwardedIp = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedIp && isIP(forwardedIp) ? forwardedIp : "unknown";
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function hashRateLimitKey(action: string, identity: string): string {
  const key = deriveSecurityKey(
    "pattani-fc/rate-limit-identity/v1",
    process.env.RATE_LIMIT_KEY_SECRET,
  );
  return createHmac("sha256", key)
    .update(action)
    .update("\0")
    .update(identity.trim().toLowerCase())
    .digest("hex");
}

type BucketRow = { count: number; expiresAt: Date };

/**
 * Fixed-window limiter backed by PostgreSQL. The INSERT ... ON CONFLICT is a
 * single atomic statement, so every PM2 worker shares the same quota and two
 * simultaneous requests cannot both consume the final allowance.
 */
export async function rateLimit(
  action: string,
  opts: { max: number; windowMs: number; ip?: string },
): Promise<RateLimitResult> {
  if (!/^[a-z0-9:_-]{1,80}$/i.test(action)) {
    throw new Error("Invalid rate-limit action");
  }
  if (!Number.isSafeInteger(opts.max) || opts.max < 1 || opts.max > 100_000) {
    throw new Error("Invalid rate-limit max");
  }
  if (
    !Number.isSafeInteger(opts.windowMs) ||
    opts.windowMs < 1_000 ||
    opts.windowMs > 7 * 24 * 60 * 60_000
  ) {
    throw new Error("Invalid rate-limit window");
  }

  ensureCleanup();
  const identity = opts.ip ?? (await getClientIp());
  const keyHash = hashRateLimitKey(action, identity || "unknown");
  const now = new Date();
  const nextExpiry = new Date(now.getTime() + opts.windowMs);
  const cap = opts.max + 1;

  try {
    const rows = await prisma.$queryRaw<BucketRow[]>`
      INSERT INTO "SecurityRateLimit"
        ("keyHash", "count", "windowStartedAt", "expiresAt", "updatedAt")
      VALUES (${keyHash}, 1, ${now}, ${nextExpiry}, ${now})
      ON CONFLICT ("keyHash") DO UPDATE SET
        "count" = CASE
          WHEN "SecurityRateLimit"."expiresAt" <= ${now} THEN 1
          ELSE LEAST("SecurityRateLimit"."count" + 1, ${cap})
        END,
        "windowStartedAt" = CASE
          WHEN "SecurityRateLimit"."expiresAt" <= ${now} THEN ${now}
          ELSE "SecurityRateLimit"."windowStartedAt"
        END,
        "expiresAt" = CASE
          WHEN "SecurityRateLimit"."expiresAt" <= ${now} THEN ${nextExpiry}
          ELSE "SecurityRateLimit"."expiresAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "expiresAt"
    `;
    const bucket = rows[0];
    if (!bucket) throw new Error("Rate-limit bucket missing");
    const ok = bucket.count <= opts.max;
    return {
      ok,
      remaining: ok ? Math.max(0, opts.max - bucket.count) : 0,
      retryAfterSec: ok
        ? 0
        : Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000)),
    };
  } catch (error) {
    // Fail closed: an unavailable limiter must never silently remove brute-force
    // protection. The business operation would depend on the same DB anyway.
    console.error("Shared rate-limit storage unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, remaining: 0, retryAfterSec: 60 };
  }
}
