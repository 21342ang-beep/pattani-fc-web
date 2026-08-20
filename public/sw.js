// Service Worker dedicated to /gate-check.
// Authenticated shell responses are cached only for the active admin session
// lifetime. Ticket/customer whitelist data stays in session-bound IndexedDB.

const VERSION = "gate-check-v2";
const CACHE_PREFIX = "gate-check-";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const MAX_SHELL_TTL_MS = 8 * 60 * 60 * 1000;
const CACHE_EXPIRY_HEADER = "X-Gate-Cache-Expires-At";

let activeSessionExpiresAt = 0;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.add("/manifest.webmanifest").catch(() => {
        // The manifest is optional; the authenticated shell is warmed only
        // after the page provides its verified session expiry.
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // Never delete caches belonging to the storefront or other PWAs.
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== SHELL_CACHE &&
              key !== STATIC_CACHE,
          )
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;

  if (message.type === "CONFIGURE_GATE_SESSION") {
    const requestedExpiry = Number(message.expiresAt);
    if (!Number.isFinite(requestedExpiry) || requestedExpiry <= Date.now()) {
      return;
    }
    activeSessionExpiresAt = Math.min(
      requestedExpiry,
      Date.now() + MAX_SHELL_TTL_MS,
    );
    event.waitUntil(warmAuthenticatedShell(activeSessionExpiresAt));
    return;
  }

  if (message.type === "CLEAR_GATE_DATA") {
    activeSessionExpiresAt = 0;
    event.waitUntil(clearGateCachesAndNotifyClients());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/gate-check") {
    event.respondWith(networkFirstGateShell(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/logo-pattani-fc.png" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
  // Server Actions and all APIs are deliberately bypassed.
});

async function warmAuthenticatedShell(expiresAt) {
  try {
    const request = new Request("/gate-check", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    const response = await fetch(request);
    if (!isAuthenticatedGateResponse(response)) return;
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, withGateExpiry(response, expiresAt));
  } catch (_) {
    // The currently loaded page still works; a later online fetch can warm it.
  }
}

async function networkFirstGateShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (
      isAuthenticatedGateResponse(fresh) &&
      activeSessionExpiresAt > Date.now()
    ) {
      cache
        .put(request, withGateExpiry(fresh, activeSessionExpiresAt))
        .catch(() => {});
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached && isCachedGateResponseLive(cached)) return cached;
    if (cached) await cache.delete(request);
    return offlineResponse();
  }
}

function isAuthenticatedGateResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic") {
    return false;
  }
  const finalUrl = new URL(response.url);
  return !response.redirected && finalUrl.pathname === "/gate-check";
}

function withGateExpiry(response, expiresAt) {
  const headers = new Headers(response.headers);
  headers.set(CACHE_EXPIRY_HEADER, String(expiresAt));
  headers.set("Cache-Control", "private, no-store, max-age=0");
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCachedGateResponseLive(response) {
  const expiresAt = Number(response.headers.get(CACHE_EXPIRY_HEADER));
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function clearGateCachesAndNotifyClients() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .map((key) => caches.delete(key)),
  );
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage({ type: "GATE_DATA_CLEARED" });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_) {
    return new Response("offline", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

function offlineResponse() {
  return new Response(
    "<h1>ออฟไลน์</h1><p>เซสชัน Gate หรือข้อมูลออฟไลน์หมดอายุ กรุณาเชื่อมต่ออินเทอร์เน็ตและเข้าสู่ระบบใหม่</p>",
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
