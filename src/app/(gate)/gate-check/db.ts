// IndexedDB storage for /gate-check. Gate data contains customer names and
// ticket credentials, so every record is bound to one short-lived admin
// session and is rejected after that session expires.

import type { WhitelistEntry } from "@/app/actions/gate-check";
import {
  decideGateStorageTransition,
  isGateOfflineSessionValid,
  isGateRecordUsable,
  nextGateAdmissionNumber,
  type GateOfflineSession,
} from "./offline-policy";

const DB_NAME = "pattani-gate-check";
const DB_VERSION = 3;
const STORE_WHITELIST = "whitelists";
const STORE_SCANS = "localScans";
const STORE_META = "metadata";
const ACTIVE_SESSION_KEY = "active-session";

type SessionBound = {
  sessionId: string;
  expiresAt: number;
};

export type StoredWhitelist = SessionBound & {
  matchId: string;
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    venue: string | null;
    kickoffAt: string | null;
  };
  entries: WhitelistEntry[];
  generatedAt: string;
};

export type WhitelistSnapshot = Omit<
  StoredWhitelist,
  "sessionId" | "expiresAt"
>;

export type LocalScan = SessionBound & {
  matchId: string;
  scanId: string;
  bookingCode: string;
  admissionNumber: number;
  scannedAt: string;
  synced: 0 | 1;
};

export type ReserveAdmissionResult =
  | { ok: true; scan: LocalScan }
  | { ok: false; previousAt: string | null; currentCount: number };

type StoredSessionMeta = {
  key: typeof ACTIVE_SESSION_KEY;
  sessionId: string;
  expiresAt: number;
};

export type GateStorageInitResult = {
  clearedLegacyData: boolean;
  clearedPreviousSession: boolean;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let activeSession: GateOfflineSession | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // v2 stored only one record per booking code. It cannot safely represent
      // quantity > 1, so do not adopt those ambiguous offline records. Clearing
      // all session-bound stores also ensures the operator must download a
      // fresh whitelist before scanning with the v3 admission-slot format.
      if ((event as IDBVersionChangeEvent).oldVersion < 3) {
        for (const storeName of [STORE_WHITELIST, STORE_SCANS, STORE_META]) {
          if (db.objectStoreNames.contains(storeName)) {
            db.deleteObjectStore(storeName);
          }
        }
      }
      if (!db.objectStoreNames.contains(STORE_WHITELIST)) {
        db.createObjectStore(STORE_WHITELIST, { keyPath: "matchId" });
      }
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        const scans = db.createObjectStore(STORE_SCANS, {
          keyPath: ["matchId", "scanId"],
        });
        scans.createIndex("by_synced", ["matchId", "synced"]);
        scans.createIndex("by_match", "matchId");
        scans.createIndex("by_booking", ["matchId", "bookingCode"]);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error("Gate offline database upgrade is blocked"));
    };
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function updateEveryRecord<T extends object>(
  store: IDBObjectStore,
  update: (record: T) => T | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const next = update(cursor.value as T);
      if (next) cursor.update(next);
      else cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function requireActiveSession(): GateOfflineSession {
  if (!activeSession || !isGateOfflineSessionValid(activeSession)) {
    activeSession = null;
    throw new Error("Gate offline session has expired");
  }
  return activeSession;
}

/**
 * Prepare the database for the server-authenticated session rendered into the
 * page. Legacy v1 records have no trustworthy owner and are purged. A
 * different or expired session is also purged rather than adopted.
 */
export async function initializeGateStorage(
  session: GateOfflineSession,
): Promise<GateStorageInitResult> {
  if (!isGateOfflineSessionValid(session)) {
    throw new Error("Gate offline session has expired");
  }

  const db = await openDb();
  const tx = db.transaction(
    [STORE_WHITELIST, STORE_SCANS, STORE_META],
    "readwrite",
  );
  const whitelistStore = tx.objectStore(STORE_WHITELIST);
  const scanStore = tx.objectStore(STORE_SCANS);
  const metaStore = tx.objectStore(STORE_META);
  const previous = await wrap<StoredSessionMeta | undefined>(
    metaStore.get(ACTIVE_SESSION_KEY),
  );

  let clearedLegacyData = false;
  let clearedPreviousSession = false;
  const transition = decideGateStorageTransition(previous, session);

  if (transition === "clear-legacy" || transition === "clear-session") {
    clearedLegacyData = transition === "clear-legacy";
    clearedPreviousSession = transition === "clear-session";
    await Promise.all([
      wrap(whitelistStore.clear()),
      wrap(scanStore.clear()),
    ]);
  } else {
    await updateEveryRecord<StoredWhitelist>(whitelistStore, (record) =>
      isGateRecordUsable(record, session) ? record : null,
    );
    await updateEveryRecord<LocalScan>(scanStore, (record) =>
      isGateRecordUsable(record, session) ? record : null,
    );
  }

  await wrap(
    metaStore.put({
      key: ACTIVE_SESSION_KEY,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    } satisfies StoredSessionMeta),
  );
  await txDone(tx);
  activeSession = session;

  return { clearedLegacyData, clearedPreviousSession };
}

export async function clearAllGateStorage(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [STORE_WHITELIST, STORE_SCANS, STORE_META],
    "readwrite",
  );
  tx.objectStore(STORE_WHITELIST).clear();
  tx.objectStore(STORE_SCANS).clear();
  tx.objectStore(STORE_META).clear();
  await txDone(tx);
  activeSession = null;
}

// ─── whitelist ─────────────────────────────────────────────

export async function saveWhitelist(
  snapshot: WhitelistSnapshot,
): Promise<StoredWhitelist> {
  const session = requireActiveSession();
  const stored: StoredWhitelist = {
    ...snapshot,
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
  const db = await openDb();
  const tx = db.transaction(STORE_WHITELIST, "readwrite");
  await wrap(tx.objectStore(STORE_WHITELIST).put(stored));
  await txDone(tx);
  return stored;
}

export async function loadWhitelist(
  matchId: string,
): Promise<StoredWhitelist | undefined> {
  const session = requireActiveSession();
  const db = await openDb();
  const tx = db.transaction(STORE_WHITELIST, "readonly");
  const result = await wrap<StoredWhitelist | undefined>(
    tx.objectStore(STORE_WHITELIST).get(matchId),
  );
  return result && isGateRecordUsable(result, session) ? result : undefined;
}

export async function deleteWhitelist(matchId: string): Promise<void> {
  requireActiveSession();
  const db = await openDb();
  const tx = db.transaction([STORE_WHITELIST, STORE_SCANS], "readwrite");
  tx.objectStore(STORE_WHITELIST).delete(matchId);
  const scanIdx = tx.objectStore(STORE_SCANS).index("by_match");
  const cursorReq = scanIdx.openCursor(IDBKeyRange.only(matchId));
  await new Promise<void>((resolve, reject) => {
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else resolve();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  await txDone(tx);
}

// ─── local scans ────────────────────────────────────────────

export async function reserveAdmissionScan(
  matchId: string,
  bookingCode: string,
  serverScannedCount: number,
  quantity: number,
  scannedAt: string,
): Promise<ReserveAdmissionResult> {
  const session = requireActiveSession();
  if (
    !Number.isInteger(serverScannedCount) ||
    serverScannedCount < 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error("Invalid gate admission state");
  }
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readwrite");
  const store = tx.objectStore(STORE_SCANS);
  const existing = await wrap<LocalScan[]>(
    store
      .index("by_booking")
      .getAll(IDBKeyRange.only([matchId, bookingCode])),
  );
  const usable = existing.filter((record) => isGateRecordUsable(record, session));
  const localAdmissionFloor = usable.reduce(
    (highest, record) => Math.max(highest, record.admissionNumber),
    0,
  );
  const admissionNumber = nextGateAdmissionNumber(
    serverScannedCount,
    localAdmissionFloor,
    quantity,
  );
  if (admissionNumber == null) {
    const previousAt = usable.reduce<string | null>((latest, record) => {
      if (!latest || record.scannedAt > latest) return record.scannedAt;
      return latest;
    }, null);
    await txDone(tx);
    return {
      ok: false,
      previousAt,
      currentCount: Math.max(serverScannedCount, localAdmissionFloor),
    };
  }

  const scan: LocalScan = {
    matchId,
    scanId: crypto.randomUUID().replaceAll("-", ""),
    bookingCode,
    admissionNumber,
    scannedAt,
    synced: 0,
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
  await wrap(
    store.add(scan),
  );
  await txDone(tx);
  return { ok: true, scan };
}

export async function listUnsyncedScans(
  matchId: string,
): Promise<LocalScan[]> {
  const session = requireActiveSession();
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readonly");
  const idx = tx.objectStore(STORE_SCANS).index("by_synced");
  const records = await wrap<LocalScan[]>(
    idx.getAll(IDBKeyRange.only([matchId, 0])),
  );
  return records
    .filter((record) => isGateRecordUsable(record, session))
    .sort(
      (a, b) =>
        a.bookingCode.localeCompare(b.bookingCode) ||
        a.admissionNumber - b.admissionNumber ||
        a.scannedAt.localeCompare(b.scannedAt) ||
        a.scanId.localeCompare(b.scanId),
    );
}

export async function countEffectiveAdmissions(
  matchId: string,
  entries: WhitelistEntry[],
): Promise<number> {
  const session = requireActiveSession();
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readonly");
  const idx = tx.objectStore(STORE_SCANS).index("by_match");
  const records = await wrap<LocalScan[]>(
    idx.getAll(IDBKeyRange.only(matchId)),
  );
  const localFloors = new Map<string, number>();
  for (const record of records) {
    if (!isGateRecordUsable(record, session)) continue;
    localFloors.set(
      record.bookingCode,
      Math.max(localFloors.get(record.bookingCode) ?? 0, record.admissionNumber),
    );
  }
  return entries.reduce(
    (total, entry) =>
      total + Math.max(entry.scannedCount, localFloors.get(entry.bookingCode) ?? 0),
    0,
  );
}

export async function markSynced(
  matchId: string,
  scanIds: string[],
): Promise<void> {
  if (scanIds.length === 0) return;
  const session = requireActiveSession();
  const db = await openDb();
  const tx = db.transaction(STORE_SCANS, "readwrite");
  const store = tx.objectStore(STORE_SCANS);
  for (const scanId of scanIds) {
    const existing = await wrap<LocalScan | undefined>(
      store.get([matchId, scanId]),
    );
    if (existing && isGateRecordUsable(existing, session)) {
      existing.synced = 1;
      await wrap(store.put(existing));
    }
  }
  await txDone(tx);
}

export async function updateWhitelistBookingState(
  matchId: string,
  bookingCode: string,
  scannedCount: number,
  scannedAt: string | null,
): Promise<void> {
  const session = requireActiveSession();
  const db = await openDb();
  const tx = db.transaction(STORE_WHITELIST, "readwrite");
  const store = tx.objectStore(STORE_WHITELIST);
  const whitelist = await wrap<StoredWhitelist | undefined>(store.get(matchId));
  if (!whitelist || !isGateRecordUsable(whitelist, session)) {
    await txDone(tx);
    return;
  }
  const entry = whitelist.entries.find(
    (candidate) => candidate.bookingCode === bookingCode,
  );
  if (entry) {
    entry.scannedCount = Math.max(0, Math.min(entry.quantity, scannedCount));
    entry.scannedAt = scannedAt;
    await wrap(store.put(whitelist));
  }
  await txDone(tx);
}
