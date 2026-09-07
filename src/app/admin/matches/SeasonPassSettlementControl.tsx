"use client";

import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmSeasonPassSettlement,
  previewSeasonPassSettlement,
  undoSeasonPassSettlement,
  type SeasonPassSettlementPreviewDto,
} from "@/app/actions/season-pass-settlements";

const tierLabels: Record<string, string> = {
  "vvip-elite": "แพ็กเกจ 4,000",
  "vip-advanced": "แพ็กเกจ 2,500",
  premium: "แพ็กเกจ 2,000",
  gold: "แพ็กเกจ 1,500",
};

type FinalizationSummary = {
  finalizedAtLabel: string;
  missedCount: number;
  postMatchCount: number;
};

export default function SeasonPassSettlementControl({
  matchId,
  matchStatus,
  initialFinalization,
}: {
  matchId: string;
  matchStatus: string;
  initialFinalization: FinalizationSummary | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<SeasonPassSettlementPreviewDto | null>(null);
  const [active, setActive] = useState(initialFinalization != null);
  const [summary, setSummary] = useState(initialFinalization);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadPreview() {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await previewSeasonPassSettlement(matchId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setPreview(result.preview);
      } catch {
        setError("ตรวจสอบข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  function confirmSettlement() {
    if (!preview?.eligible || preview.missingBarcodeOrStart > 0) return;
    const affected = preview.noShowPasses + preview.joinedAfterMatchPasses;
    const confirmed = window.confirm(
      `ยืนยันปิดแมตช์และตัดสิทธิ์บัตรรายปี?\n\n` +
      `บัตรยืนยันแล้ว ${preview.confirmedPasses} ใบ\n` +
      `สแกนแล้ว ${preview.scannedPasses} ใบ (ไม่หักซ้ำ)\n` +
      `หักสิทธิ์ ${affected} ใบ\n\n` +
      `การทำงานนี้เป็นรายการเดียวทั้งชุด หากจำนวนไม่ตรงระบบจะยกเลิกทั้งหมด`,
    );
    if (!confirmed) return;

    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await confirmSeasonPassSettlement(matchId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setActive(true);
        setSummary({
          finalizedAtLabel: "เมื่อสักครู่",
          missedCount: result.preview.noShowPasses,
          postMatchCount: result.preview.joinedAfterMatchPasses,
        });
        setPreview(result.preview);
        setMessage(result.message);
        router.refresh();
      } catch {
        setError("ยืนยันการตัดสิทธิ์ไม่สำเร็จ ระบบยังไม่เปลี่ยนข้อมูล");
      }
    });
  }

  function undoSettlement() {
    const confirmed = window.confirm(
      "ยืนยันยกเลิกการตัดสิทธิ์ของแมตช์นี้?\n\nระบบจะคืน 1 สิทธิ์เฉพาะบัตรที่เคยถูกตัดจากการปิดแมตช์นี้ ส่วนประวัติและสิทธิ์ของบัตรที่สแกนจริงจะไม่เปลี่ยน",
    );
    if (!confirmed) return;

    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await undoSeasonPassSettlement(matchId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setActive(false);
        setSummary(null);
        setPreview(result.preview);
        setMessage(result.message);
        router.refresh();
      } catch {
        setError("ยกเลิกการตัดสิทธิ์ไม่สำเร็จ ระบบยังไม่เปลี่ยนข้อมูล");
      }
    });
  }

  return (
    <div className="border-t border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-green-900">
            <ShieldCheck className="size-4" aria-hidden="true" />
            ปิดแมตช์บัตรรายปี
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            ตรวจสอบก่อนยืนยัน ระบบไม่หักบัตรที่สแกนแมตช์นี้แล้วซ้ำ และย้อนกลับได้
          </p>
        </div>

        {active ? (
          <button
            type="button"
            disabled={pending}
            onClick={undoSettlement}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {pending ? "กำลังคืนสิทธิ์..." : "ยกเลิกการตัดสิทธิ์"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || matchStatus !== "FINISHED"}
            onClick={loadPreview}
            className="rounded-lg bg-green-800 px-3 py-2 text-sm font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending ? "กำลังตรวจสอบ..." : "ตรวจสอบก่อนตัดสิทธิ์"}
          </button>
        )}
      </div>

      {matchStatus !== "FINISHED" && !active && (
        <p className="mt-3 text-xs font-medium text-amber-700">
          ปุ่มจะใช้งานได้หลังบันทึกผลการแข่งขันเป็น “จบแล้ว”
        </p>
      )}

      {active && summary && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            ตัดสิทธิ์แมตช์นี้เรียบร้อยแล้ว
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            ผู้ถือบัตรที่ไม่ได้สแกน {summary.missedCount} ใบ · ผู้ซื้อหลังเริ่มแข่งที่ปรับสิทธิ์ {summary.postMatchCount} ใบ · ดำเนินการ {summary.finalizedAtLabel}
          </p>
        </div>
      )}

      {!active && preview && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryValue label="บัตรยืนยันแล้ว" value={preview.confirmedPasses} />
            <SummaryValue label="สแกนแล้ว ไม่หักซ้ำ" value={preview.scannedPasses} tone="green" />
            <SummaryValue label="ไม่ได้สแกน จะหัก" value={preview.noShowPasses} tone="amber" />
            <SummaryValue label="ซื้อหลังเริ่มแข่ง จะปรับ" value={preview.joinedAfterMatchPasses} tone="amber" />
          </div>

          {preview.groups.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">แพ็กเกจ / โซน</th>
                    <th className="px-2 py-1.5 text-right font-semibold">ยืนยัน</th>
                    <th className="px-2 py-1.5 text-right font-semibold">สแกนแล้ว</th>
                    <th className="px-2 py-1.5 text-right font-semibold">จะหัก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {preview.groups.map((group) => (
                    <tr key={`${group.tierId}:${group.seatZone}`}>
                      <td className="px-2 py-1.5 font-medium">
                        {tierLabels[group.tierId] ?? group.tierId} · โซน {group.seatZone}
                      </td>
                      <td className="px-2 py-1.5 text-right">{group.confirmed}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-700">{group.scanned}</td>
                      <td className="px-2 py-1.5 text-right text-amber-700">
                        {group.noShow + group.joinedAfterMatch}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!preview.eligible && (
            <p className="mt-3 flex items-start gap-2 text-xs font-medium text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {preview.eligibilityError}
            </p>
          )}
          {preview.missingBarcodeOrStart > 0 && (
            <p className="mt-3 flex items-start gap-2 text-xs font-medium text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              พบข้อมูลบัตรไม่ครบ {preview.missingBarcodeOrStart} ใบ ระบบจึงปิดการยืนยันเพื่อป้องกันผลกระทบต่อลูกค้า
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setPreview(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              ปิดตัวอย่าง
            </button>
            <button
              type="button"
              disabled={pending || !preview.eligible || preview.missingBarcodeOrStart > 0}
              onClick={confirmSettlement}
              className="rounded-lg bg-green-800 px-3 py-2 text-sm font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {pending ? "กำลังตัดสิทธิ์..." : "ยืนยันปิดแมตช์และตัดสิทธิ์"}
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

function SummaryValue({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "green" | "amber";
}) {
  const valueClass = tone === "green"
    ? "text-emerald-700"
    : tone === "amber"
      ? "text-amber-700"
      : "text-slate-900";
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${valueClass}`}>{value.toLocaleString("th-TH")}</p>
    </div>
  );
}
