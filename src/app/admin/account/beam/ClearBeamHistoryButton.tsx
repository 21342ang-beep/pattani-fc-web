"use client";

import { LoaderCircle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearBeamTransactionHistory } from "@/app/actions/beam-accounting";

export default function ClearBeamHistoryButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function clearHistory() {
    setError("");
    startTransition(async () => {
      const result = await clearBeamTransactionHistory();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="size-4" /> ลบทั้งหมด
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="clear-beam-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="clear-beam-title" className="text-xl font-black text-slate-900">ลบรายละเอียดเงินเข้าทั้งหมด?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  รายการเดิมจะถูกล้างออกจากหน้าบัญชีในระบบ Pattani FC เท่านั้น ข้อมูลใน Beam และข้อมูลการจองจะไม่ถูกลบ
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={pending} aria-label="ปิด" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="size-5" />
              </button>
            </div>
            {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                ยกเลิก
              </button>
              <button type="button" onClick={clearHistory} disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 font-bold text-white hover:bg-rose-800 disabled:opacity-50">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {pending ? "กำลังลบ..." : "ยืนยันลบทั้งหมด"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
