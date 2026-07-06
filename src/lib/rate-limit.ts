import "server-only";
import { headers } from "next/headers";

// Rate limiter แบบ in-memory (เหมาะกับ single-instance dev / small prod)
// ใน production multi-instance ควรเปลี่ยนเป็น Redis/Upstash
//
// Sliding window: นับการเรียกใน window ที่ผ่านมา
// Key = `${actionName}:${ip}` กัน abuse จากแต่ละ IP

type Bucket = { timestamps: number[] };
const store = new Map<string, Bucket>();

// เก็บกวาดข้อมูลเก่าทุก ๆ 60 วินาที ป้องกัน memory leak
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 ชั่วโมง
    for (const [key, b] of store) {
      b.timestamps = b.timestamps.filter((t) => t > cutoff);
      if (b.timestamps.length === 0) store.delete(key);
    }
  }, 60_000);
  // unref ใน Node เพื่อไม่บล็อก process shutdown
  (cleanupTimer as unknown as { unref?: () => void })?.unref?.();
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export async function rateLimit(
  action: string,
  opts: { max: number; windowMs: number; ip?: string }
): Promise<RateLimitResult> {
  ensureCleanup();
  const ip = opts.ip ?? (await getClientIp());
  const key = `${action}:${ip}`;
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  const bucket = store.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= opts.max) {
    const oldest = bucket.timestamps[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((oldest + opts.windowMs - now) / 1000),
    };
  }

  bucket.timestamps.push(now);
  store.set(key, bucket);
  return {
    ok: true,
    remaining: opts.max - bucket.timestamps.length,
    retryAfterSec: 0,
  };
}
