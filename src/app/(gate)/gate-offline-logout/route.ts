import { createHash } from "node:crypto";

const cleanupScript = `(() => {
  const DB_NAME = "pattani-gate-check";
  const CACHE_PREFIX = "gate-check-";
  const CHANNEL = "pattani-gate-security";

  const notifyTabs = () => {
    try {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage({ type: "CLEAR_GATE_DATA" });
      channel.close();
    } catch (_) {}
  };

  const clearDatabase = () => new Promise((resolve) => {
    if (!("indexedDB" in window)) return resolve();
    const request = indexedDB.open(DB_NAME);
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const db = request.result;
      const stores = ["whitelists", "localScans", "metadata"]
        .filter((name) => db.objectStoreNames.contains(name));
      if (stores.length === 0) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(stores, "readwrite");
      for (const name of stores) tx.objectStore(name).clear();
      tx.oncomplete = tx.onerror = tx.onabort = () => {
        db.close();
        resolve();
      };
    };
  });

  const clearCaches = async () => {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .map((key) => caches.delete(key)));
  };

  const notifyWorkers = async () => {
    if (!("serviceWorker" in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (new URL(registration.scope).pathname.startsWith("/gate-check")) {
        registration.active?.postMessage({ type: "CLEAR_GATE_DATA" });
      }
    }
  };

  notifyTabs();
  const cleanup = Promise.allSettled([
    clearDatabase(),
    clearCaches(),
    notifyWorkers(),
  ]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 1800));
  Promise.race([cleanup, timeout]).finally(() => location.replace("/login"));
})();`;

const scriptHash = createHash("sha256")
  .update(cleanupScript)
  .digest("base64");

export async function GET() {
  const html = `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>กำลังล้างข้อมูล Gate</title>
  </head>
  <body>
    <p>กำลังล้างข้อมูลตั๋วออฟไลน์บนเครื่องนี้…</p>
    <script>${cleanupScript}</script>
    <noscript><p><a href="/login">ไปหน้าเข้าสู่ระบบ</a></p></noscript>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
