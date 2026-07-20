"use client";

import { useActionState } from "react";
import type { LegalUploadState } from "@/app/actions/legal";

export default function SalesTermsUploadForm({
  action,
}: {
  action: (previous: LegalUploadState, formData: FormData) => Promise<LegalUploadState>;
}) {
  const [state, formAction, pending] = useActionState<LegalUploadState, FormData>(action, undefined);
  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-green-100 bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="salesTermsPdf" className="block text-sm font-semibold text-green-900">ไฟล์เงื่อนไขการขาย (PDF)</label>
        <input id="salesTermsPdf" name="salesTermsPdf" type="file" accept="application/pdf,.pdf" required className="mt-2 block w-full rounded-md border border-slate-300 p-2 text-sm" />
        <p className="mt-1 text-xs text-slate-500">ขนาดไม่เกิน 10MB เมื่อบันทึกแล้วจะแทนที่ไฟล์เดิม</p>
      </div>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">อัปโหลดไฟล์สำเร็จแล้ว</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-yellow-300 disabled:opacity-60">{pending ? "กำลังอัปโหลด..." : "บันทึกไฟล์ PDF"}</button>
    </form>
  );
}
