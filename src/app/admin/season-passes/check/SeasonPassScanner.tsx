"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Loader2, ScanLine, ShieldCheck, X } from "lucide-react";
import {
  lookupSeasonPass,
  scanSeasonPass,
  type LookupSeasonPassResult,
  type ScanSeasonPassResult,
} from "@/app/actions/gate-check";
import DeleteAllSeasonPassScansButton from "./DeleteAllSeasonPassScansButton";
import DeleteSeasonPassScanButton from "./DeleteSeasonPassScanButton";

type MatchOption = {
  id: string;
  label: string;
  competitionType: "LEAGUE" | "CUP";
  competitionName: string | null;
  competitionRound: string | null;
};
type TierSummary = { id: string; badge: string; orders: number; scans: number; unregistered?: number };
type ScanHistoryItem = {
  id: string;
  scannedAt: string;
  tierId: string;
  passCode: string;
  customerName: string;
  matchLabel: string;
  competitionType: "LEAGUE" | "CUP";
  competitionDetail: string | null;
};
type ScanRecord = Extract<ScanSeasonPassResult, { ok: true }> & { id: string; at: string; matchLabel: string };
type PreviewRecord = Extract<LookupSeasonPassResult, { ok: true }> & { matchLabel: string };
type ScanError = Extract<LookupSeasonPassResult, { ok: false }>["error"];

function scanErrorMessage(error: ScanError) {
  return {
    NOT_FOUND: "ไม่พบบัตรรายปีนี้",
    DUPLICATE: "บัตรนี้ใช้สิทธิ์สำหรับแมตช์นี้ไปแล้ว",
    EXHAUSTED: "บัตรนี้ใช้สิทธิ์ครบตามจำนวนแมตช์แล้ว",
    INACTIVE: "บัตรรายปีนี้ยังไม่พร้อมใช้งาน",
    UNREGISTERED: "บัตร VVIP 4,000 นี้ยังไม่ได้ลงทะเบียนการขายออฟไลน์ กรุณาติดต่อผู้ดูแล",
    INVALID: "รูปแบบบาร์โค้ดไม่ถูกต้อง",
    MATCH_NOT_ELIGIBLE: "แมตช์นี้ไม่ได้เปิดสิทธิ์บัตรรายปี หรือไม่ใช่เกมเหย้าของ Pattani FC",
  }[error];
}

export default function SeasonPassScanner({
  matches,
  summaries,
  scanHistory,
}: {
  matches: MatchOption[];
  summaries: TierSummary[];
  scanHistory: ScanHistoryItem[];
}) {
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [matchFilter, setMatchFilter] = useState<"ALL" | "LEAGUE" | "CUP">("ALL");
  const [matchMenuOpen, setMatchMenuOpen] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [history, setHistory] = useState(scanHistory);
  const [barcode, setBarcode] = useState("");
  const [preview, setPreview] = useState<PreviewRecord | null>(null);
  const [latest, setLatest] = useState<ScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedMatch = matches.find((match) => match.id === matchId);
  const filteredMatches = matchFilter === "ALL"
    ? matches
    : matches.filter((match) => match.competitionType === matchFilter);
  const selectedTier = summaries.find((tier) => tier.id === selectedTierId);
  const selectedHistory = selectedTierId ? history.filter((scan) => scan.tierId === selectedTierId) : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = barcode.trim();
    if (!matchId) return setError("กรุณาเลือกแมตช์ก่อนสแกน");
    if (!code) return;
    setError(null);

    startTransition(async () => {
      const result = await lookupSeasonPass({ matchId, barcode: code });
      if (!result.ok) {
        setPreview(null);
        setError(scanErrorMessage(result.error));
      } else {
        setLatest(null);
        setPreview({
          ...result,
          matchLabel: matches.find((match) => match.id === matchId)?.label ?? "",
        });
      }
      setBarcode("");
    });
  }

  function confirmEntry() {
    if (!preview) return;
    setError(null);

    startTransition(async () => {
      const result = await scanSeasonPass({ matchId, barcode: preview.barcode });
      if (!result.ok) {
        setError(scanErrorMessage(result.error));
        setPreview(null);
        window.setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      setLatest({
        ...result,
        id: `${result.passCode}-${Date.now()}`,
        at: new Date().toISOString(),
        matchLabel: preview.matchLabel,
      });
      setPreview(null);
      router.refresh();
      window.setTimeout(() => inputRef.current?.focus(), 0);
    });
  }

  function cancelPreview() {
    setPreview(null);
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="แพ็กเกจบัตรรายปี">
        {summaries.map((summary) => {
          const isSelected = summary.id === selectedTierId;
          const scanCount = history.filter((scan) => scan.tierId === summary.id).length;

          return (
            <button
              key={summary.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedTierId(summary.id)}
              className={`rounded-xl border p-4 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-700/30 ${
                isSelected
                  ? "border-green-700 bg-green-50 ring-2 ring-green-700/20"
                  : "border-green-100 bg-white hover:border-green-400 hover:bg-green-50/50"
              }`}
            >
              <p className="text-sm font-bold tracking-wider text-yellow-700 md:text-base">{summary.badge}</p>
              <p className="mt-2 text-2xl font-black text-green-900 md:text-3xl">{summary.orders.toLocaleString("th-TH")} บัตร</p>
              <p className="text-base text-slate-600 md:text-lg">ใช้งานแล้ว {scanCount.toLocaleString("th-TH")} ครั้ง</p>
              {typeof summary.unregistered === "number" && summary.unregistered > 0 && (
                <p className="mt-1 text-sm font-semibold text-amber-700 md:text-base">
                  ยังไม่ลงทะเบียน {summary.unregistered.toLocaleString("th-TH")} ใบ
                </p>
              )}
              <p className="mt-2 text-sm font-semibold text-green-800 md:text-base">ดูประวัติแพ็กเกจนี้</p>
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block text-base font-semibold text-slate-800 md:text-lg">
            แมตช์ที่กำลังตรวจบัตร
            <span className="mt-1.5 flex gap-1.5" role="group" aria-label="กรองประเภทการแข่งขัน">
              {(["ALL", "LEAGUE", "CUP"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setMatchFilter(filter)}
                  className={`rounded-full px-3 py-1 text-sm font-bold ${matchFilter === filter ? "bg-green-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {filter === "ALL" ? "ทั้งหมด" : filter === "LEAGUE" ? "บอลลีก" : "บอลถ้วย"}
                </button>
              ))}
            </span>
            <div className="relative mt-1.5">
              <button
                type="button"
                onClick={() => setMatchMenuOpen((open) => !open)}
                disabled={matches.length === 0}
                aria-expanded={matchMenuOpen}
                className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-3 text-left text-base font-normal outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:cursor-not-allowed disabled:bg-slate-100 md:text-lg"
              >
                <span className="truncate">{selectedMatch?.label ?? "ยังไม่มีแมตช์ให้เลือก"}</span>
                <ChevronDown className={`ml-3 size-4 shrink-0 transition ${matchMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {matchMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                  {filteredMatches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => {
                        setMatchId(match.id);
                        setMatchMenuOpen(false);
                        setPreview(null);
                        setError(null);
                      }}
                      className={`block w-full px-3 py-3 text-left text-base hover:bg-green-50 md:text-lg ${match.id === matchId ? "bg-green-100 font-semibold text-green-900" : "text-slate-700"}`}
                    >
                      <span className="flex items-start gap-2">
                        <CompetitionBadge type={match.competitionType} />
                        <span>
                          <span className="block">{match.label}</span>
                          {(match.competitionName || match.competitionRound) && (
                            <span className="mt-0.5 block text-sm font-normal text-slate-500">
                              {[match.competitionName, match.competitionRound].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))}
                  {filteredMatches.length === 0 && (
                    <p className="px-3 py-5 text-center text-sm text-slate-500">ยังไม่มีแมตช์ประเภทนี้ที่เปิดสิทธิ์บัตรรายปี</p>
                  )}
                </div>
              )}
            </div>
          </label>
          <label className="block text-base font-semibold text-slate-800 md:text-lg">
            สแกนบาร์โค้ดบัตรรายปี
            <input
              ref={inputRef}
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              disabled={pending || preview !== null}
              autoComplete="off"
              spellCheck={false}
              placeholder="เช่น PFC26-2500-0001 หรือ SP-..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-4 py-3.5 font-mono text-lg outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 md:text-xl"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending || preview !== null || !matchId || !barcode.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-800 px-5 py-3.5 text-lg font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto md:text-xl"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <ScanLine className="size-5" />}
          ตรวจสอบข้อมูลบัตร
        </button>
        {pending && !preview && <p className="mt-3 flex items-center gap-2 text-base text-slate-600 md:text-lg"><Loader2 className="size-4 animate-spin" /> กำลังตรวจสอบข้อมูล...</p>}
        {error && !pending && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 md:text-lg">{error}</p>}
      </form>

      {preview && (
        <section className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900">
            <ShieldCheck className="size-7" />
            <h2 className="text-2xl font-bold md:text-3xl">ตรวจสอบเจ้าของบัตรก่อนยืนยัน</h2>
          </div>
          <p className="mt-2 text-base font-medium text-amber-900 md:text-lg">
            กรุณาสอบถามชื่อและเบอร์โทร 4 ตัวท้ายจากผู้ถือบัตร แล้วเปรียบเทียบกับข้อมูลด้านล่าง
          </p>
          <dl className="mt-4 grid gap-3 text-base sm:grid-cols-2 md:text-lg">
            <Info label="ชื่อเจ้าของบัตร"><span className="font-bold">{preview.customerName}</span></Info>
            <Info label="เบอร์โทร 4 ตัวท้าย"><span className="font-mono text-xl font-black">•••• {preview.customerPhoneLast4}</span></Info>
            <Info label="แพ็กเกจ">{summaries.find((tier) => tier.id === preview.tierId)?.badge ?? preview.tierId}</Info>
            <Info label="โซนที่นั่ง">{preview.seatZone}</Info>
            <Info label="รหัสบัตร"><span className="font-mono">{preview.passCode}</span></Info>
            <Info label="แมตช์">{preview.matchLabel}</Info>
            <Info label="สิทธิ์บอลลีกคงเหลือ"><span className="font-bold">{preview.usesRemaining} แมตช์</span></Info>
            {preview.competitionType === "CUP" && (
              <Info label="การหักสิทธิ์"><span className="font-bold text-green-800">บอลถ้วย — ไม่หักสิทธิ์ลีก</span></Info>
            )}
          </dl>
          <div className="mt-5 flex flex-col gap-3 border-t border-amber-200 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={confirmEntry}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-800 px-6 py-3.5 text-lg font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:text-xl"
            >
              {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
              ยืนยันให้เข้าสนาม
            </button>
            <button
              type="button"
              onClick={cancelPreview}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-lg font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 md:text-xl"
            >
              <X className="size-5" /> ข้อมูลไม่ตรง / ยกเลิก
            </button>
          </div>
        </section>
      )}

      {latest && (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="size-6" /><h2 className="text-2xl font-bold md:text-3xl">บันทึกการใช้งานบัตรรายปีแล้ว</h2></div>
          <dl className="mt-4 grid gap-3 text-base md:text-lg sm:grid-cols-2">
            <Info label="ผู้ซื้อ">{latest.customerName}</Info><Info label="เบอร์โทร 4 ตัวท้าย"><span className="font-mono">•••• {latest.customerPhoneLast4}</span></Info>
            <Info label="แพ็กเกจ">{summaries.find((tier) => tier.id === latest.tierId)?.badge ?? latest.tierId}</Info><Info label="โซนที่นั่ง">{latest.seatZone}</Info>
            <Info label="รหัสบัตร"><span className="font-mono">{latest.passCode}</span></Info><Info label="แมตช์">{latest.matchLabel}</Info>
            <Info label="สิทธิ์บอลลีกคงเหลือ"><span className="font-bold">{latest.usesRemaining} แมตช์</span></Info>
            {latest.competitionType === "CUP" && (
              <Info label="การหักสิทธิ์"><span className="font-bold text-green-800">บอลถ้วย — ไม่หักสิทธิ์ลีก</span></Info>
            )}
          </dl>
          <div className="mt-4 border-t border-emerald-200 pt-3">
            <DeleteSeasonPassScanButton scanId={latest.scanId} onDeleted={() => setLatest(null)} />
          </div>
        </section>
      )}

      {selectedTier && (
        <section className="rounded-xl border bg-white p-5 shadow-sm" role="tabpanel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-green-900 md:text-3xl">ประวัติการใช้งานบัตรรายปี · {selectedTier.badge}</h2>
              <p className="mt-1 text-base text-slate-600 md:text-lg">ลบรายการเพื่อทดสอบได้ · ระบบคืนสิทธิ์เฉพาะรายการบอลลีก ส่วนบอลถ้วยไม่เปลี่ยนโควตา</p>
            </div>
            <DeleteAllSeasonPassScansButton
              tierId={selectedTier.id}
              tierBadge={selectedTier.badge}
              onDeleted={() => {
                setHistory((current) => current.filter((scan) => scan.tierId !== selectedTier.id));
                if (latest?.tierId === selectedTier.id) setLatest(null);
              }}
            />
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[800px] text-base md:text-lg">
              <thead className="border-b bg-slate-50 text-left text-sm uppercase md:text-base">
                <tr><th className="px-3 py-2">เวลาสแกน</th><th className="px-3 py-2">รหัสบัตร</th><th className="px-3 py-2">ผู้ซื้อ</th><th className="px-3 py-2">แมตช์</th><th className="px-3 py-2 text-right">ทดสอบ</th></tr>
              </thead>
              <tbody>
                {selectedHistory.map((scan) => (
                  <tr key={scan.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-slate-600">{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(scan.scannedAt))}</td>
                    <td className="px-3 py-2 font-mono text-sm md:text-base">{scan.passCode}</td>
                    <td className="px-3 py-2">{scan.customerName}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-start gap-2"><CompetitionBadge type={scan.competitionType} /><span>{scan.matchLabel}{scan.competitionDetail ? <span className="block text-sm text-slate-500">{scan.competitionDetail}</span> : null}</span></span>
                    </td>
                    <td className="px-3 py-2 text-right"><DeleteSeasonPassScanButton scanId={scan.id} onDeleted={() => setHistory((current) => current.filter((item) => item.id !== scan.id))} /></td>
                  </tr>
                ))}
                {selectedHistory.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">ยังไม่มีประวัติการสแกนของแพ็กเกจนี้</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="flex items-center gap-2 text-base text-slate-500 md:text-lg"><ScanLine className="size-4" /> บัตร 1 ใบ สแกนได้ 1 ครั้งต่อ 1 แมตช์ — สแกนซ้ำจะแจ้งว่าใช้สิทธิ์ของแมตช์นี้แล้ว และไม่หักสิทธิ์เพิ่ม</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex gap-2"><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{children}</dd></div>;
}

function CompetitionBadge({ type }: { type: "LEAGUE" | "CUP" }) {
  return (
    <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${type === "CUP" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
      {type === "CUP" ? "ถ้วย" : "ลีก"}
    </span>
  );
}
