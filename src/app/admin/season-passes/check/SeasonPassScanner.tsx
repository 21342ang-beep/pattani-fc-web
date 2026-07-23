"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Loader2, ScanLine } from "lucide-react";
import { scanSeasonPass, type ScanSeasonPassResult } from "@/app/actions/gate-check";

type MatchOption = { id: string; label: string };
type TierSummary = { id: string; badge: string; orders: number; scans: number };
type ScanRecord = Extract<ScanSeasonPassResult, { ok: true }> & { id: string; at: string; matchLabel: string };

export default function SeasonPassScanner({ matches, summaries }: { matches: MatchOption[]; summaries: TierSummary[] }) {
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [matchMenuOpen, setMatchMenuOpen] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [latest, setLatest] = useState<ScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedMatch = matches.find((match) => match.id === matchId);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = barcode.trim();
    if (!matchId) return setError("กรุณาเลือกแมตช์ก่อนสแกน");
    if (!code) return;
    setError(null);
    startTransition(async () => {
      const result = await scanSeasonPass({ matchId, barcode: code });
      if (!result.ok) {
        const message = {
          NOT_FOUND: "ไม่พบบัตรรายปีนี้",
          DUPLICATE: "บัตรนี้ใช้สิทธิ์สำหรับแมตช์นี้ไปแล้ว",
          EXHAUSTED: "บัตรนี้ใช้สิทธิ์ครบตามจำนวนแมตช์แล้ว",
          INACTIVE: "บัตรรายปีนี้ยังไม่พร้อมใช้งาน",
          INVALID: "รูปแบบบาร์โค้ดไม่ถูกต้อง",
        }[result.error];
        setError(message);
      } else {
        setLatest({ ...result, id: `${result.passCode}-${Date.now()}`, at: new Date().toISOString(), matchLabel: matches.find((match) => match.id === matchId)?.label ?? "" });
        router.refresh();
      }
      setBarcode("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {summaries.map((summary) => (
          <div key={summary.id} className="rounded-xl border border-green-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold tracking-wider text-yellow-700">{summary.badge}</p>
            <p className="mt-2 text-lg font-black text-green-900">{summary.orders.toLocaleString("th-TH")} บัตร</p>
            <p className="text-sm text-slate-600">ใช้งานแล้ว {summary.scans.toLocaleString("th-TH")} ครั้ง</p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block text-sm font-semibold text-slate-800">
            แมตช์ที่กำลังตรวจบัตร
            <div className="relative mt-1.5">
              <button
                type="button"
                onClick={() => setMatchMenuOpen((open) => !open)}
                disabled={matches.length === 0}
                aria-expanded={matchMenuOpen}
                className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-3 text-left font-normal outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <span className="truncate">{selectedMatch?.label ?? "ยังไม่มีแมตช์ให้เลือก"}</span>
                <ChevronDown className={`ml-3 size-4 shrink-0 transition ${matchMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {matchMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                  {matches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => { setMatchId(match.id); setMatchMenuOpen(false); }}
                      className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-green-50 ${match.id === matchId ? "bg-green-100 font-semibold text-green-900" : "text-slate-700"}`}
                    >
                      {match.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            สแกนบาร์โค้ดบัตรรายปี
            <input ref={inputRef} value={barcode} onChange={(event) => setBarcode(event.target.value)} autoComplete="off" spellCheck={false} placeholder="เช่น PFC26-2500-0001 หรือ SP-..." className="mt-1.5 w-full rounded-lg border border-slate-300 px-4 py-3 font-mono outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20" />
          </label>
        </div>
        {pending && <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> กำลังบันทึกการใช้งาน...</p>}
        {error && !pending && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </form>

      {latest && (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="size-6" /><h2 className="text-lg font-bold">บันทึกการใช้งานบัตรรายปีแล้ว</h2></div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="ผู้ซื้อ">{latest.customerName}</Info><Info label="โทรศัพท์">{latest.customerPhone}</Info>
            <Info label="แพ็กเกจ">{summaries.find((tier) => tier.id === latest.tierId)?.badge ?? latest.tierId}</Info><Info label="โซนที่นั่ง">{latest.seatZone}</Info>
            <Info label="รหัสบัตร"><span className="font-mono">{latest.passCode}</span></Info><Info label="แมตช์">{latest.matchLabel}</Info>
            <Info label="สิทธิ์คงเหลือ"><span className="font-bold">{latest.usesRemaining} แมตช์</span></Info>
          </dl>
        </section>
      )}
      <p className="flex items-center gap-2 text-sm text-slate-500"><ScanLine className="size-4" /> บัตร 1 ใบ สแกนได้ 1 ครั้งต่อ 1 แมตช์ — สแกนซ้ำจะแจ้งว่าใช้สิทธิ์ของแมตช์นี้แล้ว และไม่หักสิทธิ์เพิ่ม</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex gap-2"><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{children}</dd></div>;
}
