// IndexedDB wrapper สำหรับ /gate-check
// - ไม่พึ่ง library เพิ่ม เพื่อ bundle เล็กและ offline-ready
// - 2 stores:
//     whitelists  (keyPath: matchId)     — snapshot ของ CONFIRMED bookings ต่อแมตช์
//     localScans  (keyPath: [matchId, bookingCode]) — บันทึก scan ฝั่งเครื่อง
//                 + index "unsynced" สำหรับ sync ตอนกลับมาออนไลน์

import type { WhitelistEntry } from "@/app/actions/gate-check";

const DB_NAME = "pattani-gate-check";
const DB_VERSION = 1;
const STORE_WHITELIST = "whitelists";
const STORE_SCANS = "localScans";

export type StoredWhitelist = {
  matchId: string;
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    venue: string | null;
    kickoffAt: string | null;
  };
  entries: WhitelistEntry[];
  generatedAt: string; // ISO
};

export type LocalScan = {
  matchId: string;
  bookingCode: string;
  scannedAt: string; // ISO
  synced: 0 | 1; // ใช้ number → ทำ index ได้ (IDB ไม่รองรับ boolean ใน index)
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_WHITELIST)) {
        db.createObjectStore(STORE_WHITELIST, { keyPath: "matchId" });
      }
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        const scans = db.createObjectStore(STORE_SCANS, {
          keyPath: ["matchId", "bookingCode"],
        });
        scans.createIndex("by_synced", ["matchId", "synced"]);
        scans.createIndex("by_match", "matchId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── whitelist ─────────────────────────────────────────────

export async function saveWhitelist(w: StoredWhitelist): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_WHITELIST, "readwrite");
  await wrap(tx.objectStore(STORE_WHITELIST).put(w));
  await txDone(tx);
}

export async function loadWhitelist(
  matchId: string
): Promise<StoredWhitelist | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE_WHITELIST, "readonly");
  const result = await wrap<StoredWhitelist | undefined>(
    tx.objectStore(STORE_WHITELIST).get(matchId)
  );
  return result;
}

export async function listWhitelists(): Promise<StoredWhitelist[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_WHITELIST, "readonly");
  return wrap(tx.objectStore(STORE_WHITELIST).getAll());
}

export async function deleteWhitelist(matchId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_WHITELIST, STORE_SCANS], "readwrite");
  tx.objectStore(STORE_WHITELIST).delete(matchId);
  // ล้าง localScans ของแมตช์นี้ด้วย
  const scanIdx = tx.objectStore(STORE_SCANS).index("by_match");
  const cursorReq = scanIdx.openCursor(IDBKeyRange.only(matchId));
  await new Promise<void>((resolve, reject) => {
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  await txDone(tx);
}

// ─── local scans ─────────────────────────────────────────────

export async function recordScan(
  matchId: string,
  bookingCode: string,
  scannedAt: string
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readwrite");
  await wrap(
    tx.objectStore(STORE_SCANS).put({
      matchId,
      bookingCode,
      scannedAt,
      synced: 0,
    } satisfies LocalScan)
  );
  await txDone(tx);
}

export async function getScan(
  matchId: string,
  bookingCode: string
): Promise<LocalScan | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readonly");
  return wrap(tx.objectStore(STORE_SCANS).get([matchId, bookingCode]));
}

export async function listUnsyncedScans(matchId: string): Promise<LocalScan[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readonly");
  const idx = tx.objectStore(STORE_SCANS).index("by_synced");
  return wrap(idx.getAll(IDBKeyRange.only([matchId, 0])));
}

export async function countScans(matchId: string): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readonly");
  const idx = tx.objectStore(STORE_SCANS).index("by_match");
  return wrap(idx.count(IDBKeyRange.only(matchId)));
}

export async function markSynced(
  matchId: string,
  bookingCodes: string[]
): Promise<void> {
  if (bookingCodes.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readwrite");
  const store = tx.objectStore(STORE_SCANS);
  for (const code of bookingCodes) {
    const existing = await wrap<LocalScan | undefined>(
      store.get([matchId, code])
    );
    if (existing) {
      existing.synced = 1;
      await wrap(store.put(existing));
    }
  }
  await txDone(tx);
}

// อัปเดต whitelist entry → mark ว่าฝั่ง server scan ไปแล้ว
export async function markWhitelistScanned(
  matchId: string,
  bookingCode: string,
  scannedAt: string
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_WHITELIST, "readwrite");
  const store = tx.objectStore(STORE_WHITELIST);
  const w = await wrap<StoredWhitelist | undefined>(store.get(matchId));
  if (!w) return;
  const entry = w.entries.find((e) => e.bookingCode === bookingCode);
  if (entry && !entry.scannedAt) {
    entry.scannedAt = scannedAt;
    await wrap(store.put(w));
  }
  await txDone(tx);
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
