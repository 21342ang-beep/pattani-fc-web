"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  registerOfflineVvipSeasonPass,
  type OfflineSeasonPassState,
} from "@/app/actions/offline-season-passes";

const SHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"] as const;

export default function OfflineVvipForm({ barcodes }: { barcodes: string[] }) {
  const [state, formAction, pending] = useActionState<OfflineSeasonPassState, FormData>(
    registerOfflineVvipSeasonPass,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state]);

  const errorFor = (field: string) => state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
  const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20";

  return (
    <form ref={formRef} action={formAction} className="space-y-5 rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
      {state && (
        <div className={`rounded-lg px-4 py-3 text-base font-medium ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {state.ok ? state.message : state.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="บาร์โค้ด VVIP 4,000" error={errorFor("barcode")}>
          <input
            name="barcode"
            list="available-vvip-barcodes"
            placeholder="เช่น PFC26-4000-0001"
            autoComplete="off"
            spellCheck={false}
            required
            className={`${inputClass} font-mono uppercase`}
          />
          <datalist id="available-vvip-barcodes">
            {barcodes.map((barcode) => <option key={barcode} value={barcode} />)}
          </datalist>
          <span className="mt-1 block text-sm text-slate-500">สแกนหรือเลือกได้เฉพาะบาร์โค้ดที่ยังไม่มีเจ้าของ</span>
        </Field>
        <Field label="ชื่อ-สกุลเจ้าของบัตร" error={errorFor("customerName")}>
          <input name="customerName" required minLength={2} maxLength={100} className={inputClass} />
        </Field>
        <Field label="เบอร์โทรศัพท์" error={errorFor("customerPhone")}>
          <input name="customerPhone" type="tel" inputMode="tel" placeholder="08xxxxxxxx" required className={inputClass} />
        </Field>
        <Field label="อีเมล (ไม่บังคับ)" error={errorFor("customerEmail")}>
          <input name="customerEmail" type="email" maxLength={254} className={inputClass} />
        </Field>
        <Field label="โซน" error={errorFor("seatZone")}>
          <select name="seatZone" required defaultValue="" className={inputClass}>
            <option value="" disabled>เลือกโซน</option>
            <option value="VVIP-A">VVIP-A</option>
            <option value="VVIP-B">VVIP-B</option>
          </select>
        </Field>
        <Field label="หมายเลขที่นั่ง" error={errorFor("seatNumber")}>
          <input name="seatNumber" required maxLength={30} placeholder="เช่น A-01" className={inputClass} />
        </Field>
        <Field label="ไซส์เสื้อ" error={errorFor("shirtSize")}>
          <select name="shirtSize" required defaultValue="" className={inputClass}>
            <option value="" disabled>เลือกไซส์เสื้อ</option>
            {SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </Field>
        <Field label="วิธีชำระเงิน" error={errorFor("paymentMethod")}>
          <select name="paymentMethod" required defaultValue="" className={inputClass}>
            <option value="" disabled>เลือกวิธีชำระเงิน</option>
            <option value="OFFLINE_CASH">เงินสด</option>
            <option value="OFFLINE_TRANSFER">โอนเงิน</option>
          </select>
        </Field>
        <Field label="เลขที่ใบเสร็จ / เลขอ้างอิง (ไม่บังคับ)" error={errorFor("offlineReceiptNo")}>
          <input name="offlineReceiptNo" maxLength={100} className={inputClass} />
        </Field>
        <Field label="หมายเหตุ (ไม่บังคับ)" error={errorFor("notes")}>
          <textarea name="notes" rows={3} maxLength={500} className={inputClass} />
        </Field>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        เมื่อลงทะเบียนแล้ว บาร์โค้ดจะใช้งานได้ทันทีและแก้เจ้าของผ่านฟอร์มนี้ไม่ได้ กรุณาตรวจชื่อ เบอร์โทร โซน และที่นั่งก่อนบันทึก
      </div>
      <button
        type="submit"
        disabled={pending || barcodes.length === 0}
        className="rounded-lg bg-green-800 px-5 py-3 text-lg font-bold text-yellow-300 hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "กำลังลงทะเบียน..." : "ยืนยันการขายออฟไลน์"}
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-base font-semibold text-slate-800">
      {label}
      {children}
      {error && <span className="mt-1 block text-sm font-normal text-red-600">{error}</span>}
    </label>
  );
}
