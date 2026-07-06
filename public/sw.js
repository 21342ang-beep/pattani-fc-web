// Service Worker สำหรับ /gate-check
// กลยุทธ์ cache:
//   - network-first สำหรับ HTML ของ /gate-check + RSC payload
//     → ออนไลน์: ได้ของใหม่ + อัปเดต cache
//     → ออฟไลน์: fallback เป็น cache ล่าสุด
//   - cache-first สำหรับ static assets (/_next/static/*)
//   - bypass อื่นๆ ทั้งหมด (server actions, API → ต้องการเน็ตจริงๆ)
//
// ข้อจำกัดที่ตั้งใจ:
//   - ไม่ cache server actions ตอบกลับ → กัน stale data
//   - scope จำกัดอยู่ที่ /gate-check เพื่อไม่กระทบหน้าอื่น

const VERSION = "gate-check-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // warm cache สำหรับหน้าหลัก + manifest
      cache.addAll(["/gate-check", "/manifest.webmanifest"]).catch(() => {
        // ถ้า prefetch ล้มเหลว ไม่ใช่ critical → ให้ continue
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) shell: /gate-check (และ RSC ของมัน)
  if (
    url.pathname === "/gate-check" ||
    url.pathname.startsWith("/gate-check?")
  ) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // 2) static assets ของ Next.js
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 3) icons / fonts ที่ /gate-check ต้องใช้
  if (
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/logo-pattani-fc.png" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
  // อื่นๆ ปล่อยให้ network จัดการ
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200 && fresh.type === "basic") {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(
      "<h1>ออฟไลน์</h1><p>ไม่สามารถโหลดหน้านี้ได้ — กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดครั้งแรก</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_) {
    return new Response("offline", { status: 503 });
  }
}
