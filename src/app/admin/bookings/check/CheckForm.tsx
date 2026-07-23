"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Loader2,
  ScanLine,
} from "lucide-react";
import {
  scanBooking,
  type BookingScanResult,
} from "@/app/actions/lookupBooking";
import { formatBaht, formatDateTime } from "@/lib/format";

type ScanRecord = Extract<BookingScanResult, { ok: true }> & {
  id: string;
  receivedAt: string;
};

const statusLabel: Record<string, string> = {
  PENDING: "รอชำระเงิน / ยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิก",
  REFUNDED: "คืนเงินแล้ว",
};

const CODE_FORMAT = /^[a-z0-9]{8,50}$/i;
const MAX_HISTORY = 8;

export default function CheckForm() {
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanningCodes = useRef(new Set<string>());

  const scanCode = useCallback(
    (rawCode: string) => {
      const bookingCode = rawCode.trim();
      if (!CODE_FORMAT.test(bookingCode) || scanningCodes.current.has(bookingCode)) return;

      scanningCodes.current.add(bookingCode);
      setError(null);
      startTransition(async () => {
        try {
          const response = await scanBooking(bookingCode);
          if (!response.ok) {
            setError(response.message);
            return;
          }
          const record: ScanRecord = {
            ...response,
            id: `${response.result.bookingCode}-${Date.now()}`,
            receivedAt: new Date().toISOString(),
          };
          setHistory((current) => [record, ...current].slice(0, MAX_HISTORY));
        } catch {
          setError("ไม่สามารถบันทึกการสแกนได้ กรุณาลองอีกครั้ง");
        } finally {
          scanningCodes.current.delete(bookingCode);
          setCode((current) => (current.trim() === bookingCode ? "" : current));
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }
      });
    },
    [startTransition],
  );

  // เครื่องสแกนส่วนใหญ่ส่ง Enter ปิดท้าย แต่รองรับการยิงโดยไม่มี Enter ด้วย
  useEffect(() => {
    const trimmed = code.trim();
    if (!CODE_FORMAT.test(trimmed)) return;
    const timer = window.setTimeout(() => scanCode(trimmed), 280);
    return () => window.clearTimeout(timer);
  }, [code, scanCode]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    scanCode(code);
  }

  const latest = history[0];

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm">
        <label className="block" htmlFor="booking-code">
          <span className="text-sm font-semibold text-slate-800">สแกนบาร์โค้ด / รหัสการจอง</span>
          <input
            ref={inputRef}
            id="booking-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={50}
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-base outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
            placeholder="ยิงบาร์โค้ดที่นี่"
            aria-describedby="scan-help"
          />
        </label>
        <p id="scan-help" className="mt-2 text-xs text-slate-500">
          ระบบจะล้างช่องให้เองหลังสแกน เพื่อยิงบาร์โค้ดใบถัดไปได้ทันที
        </p>
        {isPending && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" /> กำลังบันทึกการใช้งาน...
          </p>
        )}
        {error && !isPending && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </form>

      {latest && <ScanResult record={latest} featured />}

      <section aria-live="polite" className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <ScanLine className="size-5 text-green-800" /> รายการที่สแกนล่าสุด
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายการสแกนในรอบนี้</p>
        ) : (
          <div className="mt-3 space-y-3">
            {history.map((record) => (
              <ScanResult key={record.id} record={record} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScanResult({ record, featured = false }: { record: ScanRecord; featured?: boolean }) {
  const { result } = record;
  const styles = {
    SCANNED: {
      container: "border-emerald-300 bg-emerald-50",
      icon: <CheckCircle2 className="size-6 text-emerald-700" />,
      title: "ใช้งานตั๋วแล้ว",
    },
    ALREADY_SCANNED: {
      container: "border-amber-300 bg-amber-50",
      icon: <AlertTriangle className="size-6 text-amber-700" />,
      title: "สแกนแล้ว",
    },
    NOT_ELIGIBLE: {
      container: "border-red-300 bg-red-50",
      icon: <CircleX className="size-6 text-red-700" />,
      title: "ไม่สามารถใช้งานตั๋ว",
    },
  }[record.outcome];

  return (
    <article className={`rounded-xl border p-4 ${styles.container} ${featured ? "shadow-sm" : ""}`}>
      <div className="flex items-start gap-3">
        {styles.icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="font-bold text-slate-900">{styles.title}</h3>
            <time className="text-xs text-slate-600" dateTime={record.receivedAt}>
              {formatDateTime(record.receivedAt)}
            </time>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-700">{record.message}</p>
          <dl className="mt-3 grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
            <Info label="รหัสการจอง"><span className="font-mono">{result.bookingCode}</span></Info>
            <Info label="ผู้จอง">{result.customerName}</Info>
            <Info label="แมตช์">{result.match.homeTeam} vs {result.match.awayTeam}</Info>
            <Info label="จำนวน">{result.quantity} ใบ · {formatBaht(result.totalAmount)}</Info>
            <Info label="ใช้สิทธิ์">{result.scanCount}/{result.quantity} ใบ · เหลือ {result.remainingScans} ใบ</Info>
            <Info label="สถานะ">{statusLabel[result.status] ?? result.status}</Info>
            <Info label="เวลาสแกน">
              {result.lastScannedAt ? formatDateTime(result.lastScannedAt) : "ยังไม่ถูกบันทึกใช้"}
            </Info>
          </dl>
        </div>
      </div>
    </article>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{children}</dd>
    </div>
  );
}
