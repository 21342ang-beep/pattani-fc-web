"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Loader2,
  Download,
  RefreshCw,
  Trash2,
  Search,
  Calendar,
  MapPin,
  ScanLine,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import {
  downloadWhitelist,
  scanSeasonPass,
  syncScans,
  type WhitelistEntry,
} from "@/app/actions/gate-check";
import {
  countEffectiveAdmissions,
  clearAllGateStorage,
  deleteWhitelist,
  initializeGateStorage,
  listUnsyncedScans,
  loadWhitelist,
  markSynced,
  reserveAdmissionScan,
  saveWhitelist,
  type StoredWhitelist,
  updateWhitelistBookingState,
} from "./db";
import {
  GATE_CACHE_PREFIX,
  GATE_OFFLINE_REVOKED_COOKIE,
  type GateOfflineSession,
} from "./offline-policy";

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  kickoffAt: string | null;
  status: string;
  confirmedCount: number;
};

type ScanState =
  | { kind: "idle" }
  | { kind: "ok"; entry: WhitelistEntry; at: string }
  | { kind: "duplicate"; entry: WhitelistEntry; previousAt: string; source: "local" | "server" }
  | { kind: "unknown"; code: string }
  | { kind: "invalid"; reason: string };

const CODE_FORMAT = /^[a-z0-9._-]{8,256}$/i;

// subscribe online/offline ผ่าน useSyncExternalStore → ไม่ต้อง setState ใน useEffect
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const getOnlineSnapshot = () => navigator.onLine;
const getOnlineServerSnapshot = () => true;

type GateStorageState = "initializing" | "ready" | "expired" | "revoked" | "error";

function hasLogoutRevocationMarker(): boolean {
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${GATE_OFFLINE_REVOKED_COOKIE}=`));
}

async function clearGateCacheStorage(notifyWorker: boolean): Promise<void> {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(GATE_CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    );
  }
  if (notifyWorker && "serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (new URL(registration.scope).pathname.startsWith("/gate-check")) {
        registration.active?.postMessage({ type: "CLEAR_GATE_DATA" });
      }
    }
  }
}

export default function GateCheckClient({
  initialMatches,
  offlineSession,
}: {
  initialMatches: Match[];
  offlineSession: GateOfflineSession;
}) {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [whitelist, setWhitelist] = useState<StoredWhitelist | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ kind: "idle" });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [recent, setRecent] = useState<ScanState[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [storageState, setStorageState] =
    useState<GateStorageState>("initializing");
  const inputRef = useRef<HTMLInputElement>(null);
  const storageRevokedRef = useRef(false);

  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );

  const lockGateStorage = useCallback(
    async (
      reason: Exclude<GateStorageState, "initializing" | "ready">,
      notifyWorker = true,
    ) => {
      storageRevokedRef.current = true;
      await Promise.allSettled([
        clearAllGateStorage(),
        clearGateCacheStorage(notifyWorker),
      ]);
      setWhitelist(null);
      setActiveMatchId(null);
      setUnsyncedCount(0);
      setScannedCount(0);
      setRecent([]);
      setScanState({ kind: "idle" });
      setStorageState(reason);
    },
    [],
  );

  // Bind IndexedDB to this exact admin login and erase it at session expiry.
  useEffect(() => {
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      if (hasLogoutRevocationMarker()) {
        await lockGateStorage("revoked");
        return;
      }
      try {
        const result = await initializeGateStorage(offlineSession);
        if (cancelled || storageRevokedRef.current) return;
        setStorageState("ready");
        if (result.clearedLegacyData || result.clearedPreviousSession) {
          setSyncMessage(
            result.clearedLegacyData
              ? "ล้างข้อมูล Gate รุ่นเก่าที่ไม่ทราบเจ้าของแล้ว กรุณาดาวน์โหลด whitelist ใหม่"
              : "ล้างข้อมูล Gate ของเซสชันก่อนหน้าแล้ว",
          );
        }
        const remainingMs = offlineSession.expiresAt - Date.now();
        if (remainingMs <= 0) {
          await lockGateStorage("expired");
          return;
        }
        expiryTimer = setTimeout(() => {
          void lockGateStorage("expired");
        }, remainingMs);
      } catch {
        if (!cancelled) await lockGateStorage("error");
      }
    })();

    return () => {
      cancelled = true;
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [lockGateStorage, offlineSession]);

  // Lock other open Gate tabs as soon as logout/cleanup occurs in this origin.
  useEffect(() => {
    const handleClear = () => {
      void lockGateStorage("revoked", false);
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "GATE_DATA_CLEARED") handleClear();
    };
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel("pattani-gate-security")
        : null;
    if (channel) channel.onmessage = handleClear;
    return () => {
      navigator.serviceWorker?.removeEventListener(
        "message",
        handleWorkerMessage,
      );
      channel?.close();
    };
  }, [lockGateStorage]);

  // ─── PWA service worker register (ครั้งเดียวต่อ session) ─────────
  useEffect(() => {
    if (storageState !== "ready") return;
    if (!("serviceWorker" in navigator)) return;
    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/gate-check",
        });
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          type: "CONFIGURE_GATE_SESSION",
          expiresAt: offlineSession.expiresAt,
        });
      } catch (error) {
        console.warn("SW register failed", error);
      }
    })();
  }, [offlineSession.expiresAt, storageState]);

  // ─── โหลด whitelist จาก IndexedDB เมื่อเลือกแมตช์ ─────
  // setState เฉพาะใน async callback หลัง await → ไม่กระทบ render synchronous
  useEffect(() => {
    if (storageState !== "ready" || !activeMatchId) return;
    let cancelled = false;
    void (async () => {
      const w = await loadWhitelist(activeMatchId);
      if (cancelled) return;
      setWhitelist(w ?? null);
      const [unsynced, scanned] = await Promise.all([
        listUnsyncedScans(activeMatchId),
        countEffectiveAdmissions(activeMatchId, w?.entries ?? []),
      ]);
      if (cancelled) return;
      setUnsyncedCount(unsynced.length);
      setScannedCount(scanned);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeMatchId, storageState]);

  // ─── auto focus input ตลอด — เครื่องสแกน USB ยิงเข้าได้ทันที ────
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    focus();
    window.addEventListener("click", focus);
    return () => window.removeEventListener("click", focus);
  }, [whitelist]);

  // ─── lookup map สำหรับ O(1) lookup ─────────────────
  const lookupMap = useMemo(() => {
    if (!whitelist) return null;
    const m = new Map<string, WhitelistEntry>();
    for (const e of whitelist.entries) m.set(e.bookingCode.toLowerCase(), e);
    return m;
  }, [whitelist]);

  const addRecent = useCallback((s: ScanState) => {
    setRecent((prev) => [s, ...prev].slice(0, 5));
  }, []);

  // ─── handle scan (เรียกตอนกด Enter) ────────────────
  const handleScan = useCallback(
    async (raw: string) => {
      if (!activeMatchId || !lookupMap || !whitelist) return;
      const scannedValue = raw.trim();
      if (!CODE_FORMAT.test(scannedValue)) {
        setScanState({ kind: "invalid", reason: "รหัสไม่ถูกต้อง" });
        return;
      }
      // Season-pass scans are always checked online; unlike match tickets they
      // must reject a second scan at another gate immediately.
      const upperValue = scannedValue.toUpperCase();
      if (
        scannedValue.startsWith("SPG2.") ||
        scannedValue.startsWith("SPG1.") ||
        upperValue.startsWith("PFC26-") ||
        upperValue.startsWith("SP-")
      ) {
        if (!online) {
          setScanState({ kind: "invalid", reason: "บัตรรายปีต้องสแกนขณะเชื่อมต่ออินเทอร์เน็ต" });
          return;
        }
        const result = await scanSeasonPass({
          matchId: activeMatchId,
          barcode: scannedValue,
        });
        if (!result.ok) {
          const reasons = {
            NOT_FOUND: "ไม่พบบัตรรายปีนี้",
            DUPLICATE: "บัตรนี้ใช้สิทธิ์สำหรับแมตช์นี้ไปแล้ว",
            EXHAUSTED: "บัตรนี้ใช้สิทธิ์ครบ 15 ครั้งแล้ว",
            INACTIVE: "บัตรรายปีนี้ยังไม่พร้อมใช้งาน",
            UNREGISTERED: "บัตร VVIP 4,000 นี้ยังไม่ได้ลงทะเบียนการขายออฟไลน์",
            INVALID: "รูปแบบบาร์โค้ดไม่ถูกต้อง",
            MATCH_NOT_ELIGIBLE: "แมตช์นี้ไม่ได้เปิดสิทธิ์บัตรรายปี หรือไม่ใช่เกมเหย้าของ Pattani FC",
          };
          const state: ScanState = { kind: "invalid", reason: reasons[result.error] };
          setScanState(state);
          addRecent(state);
          void playBeep(false);
          return;
        }
        const entry: WhitelistEntry = {
          bookingCode: result.passCode,
          customerName: result.customerName,
          quantity: 1,
          seatNumbers: [result.competitionType === "CUP"
            ? `Season Pass · บอลถ้วย (ไม่หักสิทธิ์ลีก) · ลีกเหลือ ${result.usesRemaining}/15`
            : `Season Pass · ลีกเหลือ ${result.usesRemaining}/15`],
          scannedCount: 1,
          scannedAt: null,
        };
        const state: ScanState = { kind: "ok", entry, at: new Date().toISOString() };
        setScanState(state);
        addRecent(state);
        void playBeep(true);
        return;
      }
      const code = scannedValue.toLowerCase();
      const entry = lookupMap.get(code);
      if (!entry) {
        setScanState({ kind: "unknown", code });
        addRecent({ kind: "unknown", code });
        return;
      }

      // Reserve one admission slot in a single IndexedDB transaction. This
      // lets the same booking code enter up to quantity times while preventing
      // rapid scans/tabs on this device from allocating the same slot twice.
      const at = new Date().toISOString();
      const reservation = await reserveAdmissionScan(
        activeMatchId,
        entry.bookingCode,
        entry.scannedCount,
        entry.quantity,
        at,
      );
      if (!reservation.ok) {
        const state: ScanState = {
          kind: "duplicate",
          entry: {
            ...entry,
            scannedCount: Math.min(entry.quantity, reservation.currentCount),
          },
          previousAt: reservation.previousAt ?? entry.scannedAt ?? at,
          source: reservation.previousAt ? "local" : "server",
        };
        setScanState(state);
        addRecent(state);
        return;
      }

      setUnsyncedCount((n) => n + 1);
      setScannedCount((n) => n + 1);
      const state: ScanState = {
        kind: "ok",
        entry: {
          ...entry,
          scannedCount: reservation.scan.admissionNumber,
          scannedAt: at,
        },
        at,
      };
      setScanState(state);
      addRecent(state);

      // beep success — ใช้ Web Audio API เพื่อ feedback ไม่ต้องโหลด asset
      void playBeep(true);
    },
    [activeMatchId, lookupMap, whitelist, addRecent, online]
  );

  // ─── ดาวน์โหลด whitelist (online เท่านั้น) ─────────
  const handleDownload = useCallback(
    async (matchId: string) => {
      if (storageState !== "ready") return;
      setIsDownloading(true);
      try {
        const result = await downloadWhitelist(matchId);
        if (!result.ok) {
          alert(result.error);
          return;
        }
        const match = initialMatches.find((m) => m.id === matchId);
        if (!match) return;
        const stored = await saveWhitelist({
          matchId: result.matchId,
          matchInfo: {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            venue: match.venue,
            kickoffAt: match.kickoffAt,
          },
          entries: result.entries,
          generatedAt: result.generatedAt,
        });
        setWhitelist(stored);
        setActiveMatchId(matchId);
      } finally {
        setIsDownloading(false);
      }
    },
    [initialMatches, storageState]
  );

  // ─── sync scan กลับ server (auto + manual) ────────
  const handleSync = useCallback(async () => {
    if (!activeMatchId || isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const pending = await listUnsyncedScans(activeMatchId);
      if (pending.length === 0) {
        setSyncMessage("ไม่มีรายการต้อง sync");
        return;
      }
      const batch = pending.slice(0, 500);
      const result = await syncScans({
        matchId: activeMatchId,
        records: batch.map((p) => ({
          scanId: p.scanId,
          bookingCode: p.bookingCode,
          admissionNumber: p.admissionNumber,
          scannedAt: p.scannedAt,
        })),
      });
      if (!result.ok) {
        setSyncMessage(`Sync ล้มเหลว: ${result.error}`);
        return;
      }
      const synced = [
        ...result.accepted,
        ...result.duplicates,
        ...result.conflicts.map((c) => c.scanId),
        ...result.unknown,
      ];
      await markSynced(activeMatchId, synced);
      for (const state of result.bookingStates) {
        await updateWhitelistBookingState(
          activeMatchId,
          state.bookingCode,
          state.scannedCount,
          state.latestScannedAt,
        );
      }
      const w = await loadWhitelist(activeMatchId);
      if (w) setWhitelist(w);
      const remain = await listUnsyncedScans(activeMatchId);
      setUnsyncedCount(remain.length);
      if (w) {
        setScannedCount(await countEffectiveAdmissions(activeMatchId, w.entries));
      }
      setSyncMessage(
        `Sync เสร็จ — รับ ${result.accepted.length} · ซ้ำ ${result.duplicates.length} · ชนกับประตูอื่น ${result.conflicts.length} · ไม่พบ ${result.unknown.length}${remain.length > 0 ? ` · เหลือ ${remain.length}` : ""}`
      );
    } finally {
      setIsSyncing(false);
    }
  }, [activeMatchId, isSyncing]);

  // ─── auto sync เมื่อกลับมา online ────────────────
  // defer ผ่าน setTimeout → setState ใน handleSync ไม่ถือว่า synchronous-in-effect
  useEffect(() => {
    if (!online || !activeMatchId || unsyncedCount === 0 || isSyncing) return;
    const id = setTimeout(() => {
      void handleSync();
    }, 0);
    return () => clearTimeout(id);
  }, [online, activeMatchId, unsyncedCount, isSyncing, handleSync]);

  // ─── ล้างข้อมูล offline (security: หลังใช้งานเสร็จ) ────
  const handleClear = useCallback(async () => {
    if (!activeMatchId) return;
    if (
      unsyncedCount > 0 &&
      !confirm(`ยังมี ${unsyncedCount} รายการที่ยังไม่ sync ลบทิ้งหรือไม่?`)
    )
      return;
    if (!confirm("ลบ whitelist และข้อมูลสแกนของแมตช์นี้บนเครื่อง?")) return;
    await deleteWhitelist(activeMatchId);
    setWhitelist(null);
    setActiveMatchId(null);
    setUnsyncedCount(0);
    setScannedCount(0);
    setRecent([]);
    setScanState({ kind: "idle" });
  }, [activeMatchId, unsyncedCount]);

  // ─── RENDER ─────────────────────────────────────
  if (storageState !== "ready") {
    return <GateStorageGuard state={storageState} online={online} />;
  }

  if (!activeMatchId || !whitelist) {
    return (
      <MatchPicker
        matches={initialMatches}
        onDownload={handleDownload}
        isDownloading={isDownloading}
        online={online}
        offlineExpiresAt={offlineSession.expiresAt}
        onResume={async (mid) => {
          const w = await loadWhitelist(mid);
          if (w) {
            setWhitelist(w);
            setActiveMatchId(mid);
          } else {
            alert("ไม่พบ whitelist ในเครื่อง กรุณาดาวน์โหลดใหม่");
          }
        }}
      />
    );
  }

  const total = whitelist.entries.reduce(
    (sum, entry) => sum + entry.quantity,
    0,
  );
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-green-900/50 bg-green-950/80 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveMatchId(null)}
              className="rounded-md p-1.5 hover:bg-green-900/50"
              title="กลับไปเลือกแมตช์"
            >
              <ArrowLeft className="size-5 text-yellow-300" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-yellow-300 md:text-xl">
                {whitelist.matchInfo.homeTeam} vs {whitelist.matchInfo.awayTeam}
              </h1>
              <p className="text-xs text-green-200">
                {whitelist.matchInfo.venue ?? "—"} ·{" "}
                {whitelist.matchInfo.kickoffAt
                  ? new Date(whitelist.matchInfo.kickoffAt).toLocaleString("th-TH")
                  : "—"}
              </p>
              <p className="mt-0.5 text-[10px] text-amber-300/80">
                ข้อมูลออฟไลน์ใช้ได้ถึง {new Date(offlineSession.expiresAt).toLocaleString("th-TH")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-1 ${
                online ? "bg-emerald-900/70 text-emerald-200" : "bg-amber-900/70 text-amber-200"
              }`}
            >
              {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {online ? "ออนไลน์" : "ออฟไลน์"}
            </span>
            {unsyncedCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-1 font-bold text-amber-950">
                {unsyncedCount} รอ sync
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-10">
        {/* Big input */}
        <div className="rounded-2xl border-2 border-green-700 bg-green-950/40 p-4 shadow-xl md:p-6">
          <label className="block">
            <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-green-300">
              <ScanLine className="size-4" /> ยิงบาร์โค้ดที่ช่องนี้
            </span>
            <input
              ref={inputRef}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              maxLength={256}
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                const v = e.currentTarget.value;
                e.currentTarget.value = "";
                await handleScan(v);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="mt-2 w-full rounded-xl border-2 border-green-700 bg-slate-900 px-4 py-4 text-2xl font-mono tracking-wider text-yellow-200 placeholder-green-700 outline-none focus:border-yellow-300 md:text-3xl"
              placeholder="รอสแกน..."
            />
          </label>
          <p className="mt-2 text-[11px] text-green-300/70">
            เครื่องสแกน USB จะยิงเข้า + กด Enter ให้อัตโนมัติ — ระบบจะตรวจสอบและล้างช่องให้ทันที
          </p>
        </div>

        {/* Result */}
        <div className="mt-4">
          <ScanResultBox state={scanState} />
        </div>

        {/* Stats + actions */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="ผ่านประตูแล้ว" value={`${scannedCount} / ${total}`} accent />
          <Stat label="รอ sync" value={String(unsyncedCount)} />
          <Stat
            label="ดาวน์โหลดเมื่อ"
            value={new Date(whitelist.generatedAt).toLocaleTimeString("th-TH")}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={!online || isSyncing || unsyncedCount === 0}
            className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-green-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sync ขึ้น server
          </button>
          <button
            onClick={() => handleDownload(activeMatchId)}
            disabled={!online || isDownloading}
            className="inline-flex items-center gap-2 rounded-full border border-green-700 bg-slate-900 px-4 py-2 text-sm font-medium text-green-200 hover:bg-green-900/50 disabled:opacity-40"
          >
            {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            อัปเดต whitelist
          </button>
          <button
            onClick={handleClear}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-red-700/50 bg-slate-900 px-4 py-2 text-xs text-red-300 hover:bg-red-950/50"
          >
            <Trash2 className="size-3.5" /> ล้างข้อมูลเครื่องนี้
          </button>
        </div>
        {syncMessage && (
          <p className="mt-3 rounded-md bg-green-900/40 px-3 py-2 text-xs text-green-200">
            {syncMessage}
          </p>
        )}

        {/* Recent scans */}
        {recent.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-green-300">
              5 รายการล่าสุด
            </h2>
            <ul className="space-y-2">
              {recent.map((r, i) => (
                <li key={i}>
                  <ScanResultRow state={r} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── sub-components ─────────────────────────────────

function GateStorageGuard({
  state,
  online,
}: {
  state: Exclude<GateStorageState, "ready">;
  online: boolean;
}) {
  const messages = {
    initializing: {
      title: "กำลังเตรียมข้อมูล Gate ที่ปลอดภัย",
      detail: "กำลังตรวจอายุและเจ้าของข้อมูลออฟไลน์บนเครื่องนี้…",
    },
    expired: {
      title: "เซสชัน Gate หมดอายุแล้ว",
      detail: "ข้อมูลตั๋วออฟไลน์ถูกล้างแล้ว กรุณาเข้าสู่ระบบและดาวน์โหลดใหม่",
    },
    revoked: {
      title: "ออกจากระบบแล้ว",
      detail: "ข้อมูลตั๋วออฟไลน์บนเครื่องนี้ถูกล้างเพื่อความปลอดภัย",
    },
    error: {
      title: "ไม่สามารถเปิดพื้นที่ข้อมูล Gate ได้",
      detail: "ระบบปิดการสแกนไว้ก่อนเพื่อไม่ให้ใช้ข้อมูลที่ไม่ยืนยัน",
    },
  } as const;
  const message = messages[state];

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-700/60 bg-slate-900 p-6 text-center shadow-xl">
        {state === "initializing" ? (
          <Loader2 className="mx-auto size-10 animate-spin text-yellow-300" />
        ) : (
          <ShieldAlert className="mx-auto size-10 text-amber-300" />
        )}
        <h1 className="mt-4 text-xl font-bold text-yellow-200">
          {message.title}
        </h1>
        <p className="mt-2 text-sm text-green-100/80">{message.detail}</p>
        {state !== "initializing" && (
          <a
            href="/login"
            className="mt-5 inline-flex rounded-full bg-yellow-400 px-5 py-2 text-sm font-bold text-green-950 hover:bg-yellow-300"
          >
            {online ? "เข้าสู่ระบบใหม่" : "เชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบ"}
          </a>
        )}
      </div>
    </main>
  );
}

function MatchPicker({
  matches,
  onDownload,
  onResume,
  isDownloading,
  online,
  offlineExpiresAt,
}: {
  matches: Match[];
  onDownload: (id: string) => void;
  onResume: (id: string) => void;
  isDownloading: boolean;
  online: boolean;
  offlineExpiresAt: number;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 md:px-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-yellow-300">Gate Check</h1>
          <span
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
              online ? "bg-emerald-900/70 text-emerald-200" : "bg-amber-900/70 text-amber-200"
            }`}
          >
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? "ออนไลน์" : "ออฟไลน์"}
          </span>
        </div>
        <p className="mt-2 text-sm text-green-200">
          เลือกแมตช์ที่จะคุมประตู → ดาวน์โหลด whitelist (ต้องมีเน็ต) → ใช้งานออฟไลน์ได้
        </p>
        <p className="mt-1 text-xs text-amber-300/80">
          ข้อมูลออฟไลน์ของรอบนี้หมดอายุ {new Date(offlineExpiresAt).toLocaleString("th-TH")}
        </p>
        <a
          href="/admin"
          className="mt-2 inline-flex items-center gap-1 text-xs text-green-300 hover:text-yellow-300"
        >
          <ArrowLeft className="size-3" /> กลับหลังบ้าน
        </a>
      </header>

      {matches.length === 0 ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-6 text-center text-sm text-amber-200">
          ไม่มีแมตช์ที่ใช้งานได้ในตอนนี้
        </p>
      ) : (
        <ul className="space-y-3">
          {matches.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-green-800 bg-green-950/40 p-4 shadow-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-yellow-200 md:text-lg">
                    {m.homeTeam} vs {m.awayTeam}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-green-300">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {m.venue ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {m.kickoffAt
                        ? new Date(m.kickoffAt).toLocaleString("th-TH")
                        : "—"}
                    </span>
                    <span className="rounded bg-green-900/70 px-2 py-0.5 text-[10px]">
                      {m.status}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-green-200">
                    CONFIRMED บนระบบ: <b>{m.confirmedCount}</b> ใบ
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => onDownload(m.id)}
                    disabled={!online || isDownloading}
                    className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-green-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                    title={!online ? "ต้องออนไลน์เพื่อโหลด" : ""}
                  >
                    {isDownloading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    ดาวน์โหลด + เปิด
                  </button>
                  <button
                    onClick={() => onResume(m.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-green-700 bg-slate-900 px-4 py-1.5 text-xs text-green-200 hover:bg-green-900/50"
                  >
                    <Search className="size-3" /> ใช้ข้อมูลที่มี
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScanResultBox({ state }: { state: ScanState }) {
  if (state.kind === "idle") {
    return (
      <div className="rounded-xl border-2 border-dashed border-green-900 bg-slate-900/50 px-4 py-8 text-center text-sm text-green-400">
        รอสแกนตั๋วใบแรก...
      </div>
    );
  }
  if (state.kind === "ok") {
    return (
      <div className="rounded-xl border-4 border-emerald-400 bg-emerald-950/70 px-4 py-6 shadow-lg shadow-emerald-500/20">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-12 text-emerald-300" />
          <div>
            <p className="text-2xl font-black text-emerald-200">ผ่าน ✓</p>
            <p className="text-sm text-emerald-300">เข้าได้</p>
          </div>
        </div>
        <Divider color="emerald" />
        <Detail entry={state.entry} />
        <p className="mt-2 text-xs text-emerald-300/70">
          สแกนเมื่อ {new Date(state.at).toLocaleTimeString("th-TH")}
        </p>
      </div>
    );
  }
  if (state.kind === "duplicate") {
    return (
      <div className="rounded-xl border-4 border-amber-400 bg-amber-950/70 px-4 py-6 shadow-lg shadow-amber-500/20">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-12 text-amber-300" />
          <div>
            <p className="text-2xl font-black text-amber-200">เคยเข้าแล้ว ⚠</p>
            <p className="text-sm text-amber-300">
              สแกนเมื่อ {new Date(state.previousAt).toLocaleString("th-TH")}
              {state.source === "server" ? " (อีกเครื่อง)" : " (เครื่องนี้)"}
            </p>
          </div>
        </div>
        <Divider color="amber" />
        <Detail entry={state.entry} />
      </div>
    );
  }
  if (state.kind === "unknown") {
    return (
      <div className="rounded-xl border-4 border-red-400 bg-red-950/70 px-4 py-6 shadow-lg shadow-red-500/20">
        <div className="flex items-center gap-3">
          <XCircle className="size-12 text-red-300" />
          <div>
            <p className="text-2xl font-black text-red-200">ไม่ผ่าน ✕</p>
            <p className="text-sm text-red-300">ไม่พบรหัสในรายการของแมตช์นี้</p>
          </div>
        </div>
        <p className="mt-3 font-mono text-xs text-red-300/80">{state.code}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border-2 border-red-700 bg-red-950/50 px-4 py-4 text-sm text-red-200">
      {state.reason}
    </div>
  );
}

function ScanResultRow({ state }: { state: ScanState }) {
  if (state.kind === "ok") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
        <CheckCircle2 className="size-4 shrink-0" />
        <span className="font-mono">{state.entry.bookingCode.slice(0, 12)}…</span>
        <span className="ml-1 truncate">{state.entry.customerName}</span>
        <span className="ml-auto text-emerald-300/60">
          {new Date(state.at).toLocaleTimeString("th-TH")}
        </span>
      </div>
    );
  }
  if (state.kind === "duplicate") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="font-mono">{state.entry.bookingCode.slice(0, 12)}…</span>
        <span className="ml-1 truncate">{state.entry.customerName}</span>
        <span className="ml-auto text-amber-300/60">ซ้ำ</span>
      </div>
    );
  }
  if (state.kind === "unknown") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-950/40 px-3 py-2 text-xs text-red-200">
        <XCircle className="size-4 shrink-0" />
        <span className="font-mono">{state.code.slice(0, 16)}…</span>
        <span className="ml-auto">ไม่พบ</span>
      </div>
    );
  }
  return null;
}

function Detail({ entry }: { entry: WhitelistEntry }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex gap-2">
        <dt className="w-20 text-slate-400">รหัส</dt>
        <dd className="flex-1 font-mono text-xs">{entry.bookingCode}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-20 text-slate-400">ชื่อ</dt>
        <dd className="flex-1 font-semibold">{entry.customerName}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-20 text-slate-400">จำนวน</dt>
        <dd className="flex-1">{entry.quantity} ใบ</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-20 text-slate-400">ใช้แล้ว</dt>
        <dd className="flex-1">
          {entry.scannedCount}/{entry.quantity} ใบ
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-20 text-slate-400">ที่นั่ง</dt>
        <dd className="flex-1">
          {entry.seatNumbers.length > 0 ? entry.seatNumbers.join(", ") : "—"}
        </dd>
      </div>
    </dl>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent
          ? "border-yellow-500/50 bg-yellow-950/30"
          : "border-green-800 bg-green-950/30"
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-green-300/70">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          accent ? "text-yellow-300" : "text-green-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Divider({ color }: { color: "emerald" | "amber" }) {
  const cls = color === "emerald" ? "border-emerald-700" : "border-amber-700";
  return <div className={`my-3 border-t ${cls}`} />;
}

// Web Audio beep — feedback เร็วโดยไม่ต้องโหลดไฟล์
async function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = success ? 880 : 220;
    g.gain.value = 0.08;
    o.start();
    setTimeout(() => {
      o.stop();
      void ctx.close();
    }, 120);
  } catch {
    // เงียบไป
  }
}
