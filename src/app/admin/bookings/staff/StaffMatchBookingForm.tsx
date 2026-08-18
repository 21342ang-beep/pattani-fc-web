"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffBooking, type StaffBookingState } from "@/app/actions/staff-bookings";
import { formatBaht } from "@/lib/format";

type MatchOption = {
  id: string;
  label: string;
  kickoffLabel: string;
  venue: string | null;
  zones: { code: string; name: string; price: number; remaining: number }[];
};

export default function StaffMatchBookingForm({ matches }: { matches: MatchOption[] }) {
  const [state, formAction, pending] = useActionState<StaffBookingState, FormData>(createStaffBooking, undefined);
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [zoneCode, setZoneCode] = useState(matches[0]?.zones[0]?.code ?? "");
  const [quantity, setQuantity] = useState(1);
  const [paymentChoice, setPaymentChoice] = useState("PAY_LATER");
  const [requestId, setRequestId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const selectedMatch = useMemo(() => matches.find((match) => match.id === matchId) ?? matches[0], [matchId, matches]);
  const selectedZone = useMemo(() => selectedMatch?.zones.find((zone) => zone.code === zoneCode) ?? selectedMatch?.zones[0], [selectedMatch, zoneCode]);

  useEffect(() => setRequestId(crypto.randomUUID()), []);
  useEffect(() => {
    if (!selectedMatch?.zones.some((zone) => zone.code === zoneCode)) setZoneCode(selectedMatch?.zones[0]?.code ?? "");
  }, [selectedMatch, zoneCode]);
  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setQuantity(1);
    setPaymentChoice("PAY_LATER");
    setRequestId(crypto.randomUUID());
    router.refresh();
  }, [router, state]);

  const errorFor = (field: string) => state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
  const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:bg-slate-100";

  if (matches.length === 0) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">ยังไม่มีแมตช์เหย้าที่เปิดขายและกำหนดราคา/จำนวนที่นั่งครบ จึงยังสร้างรายการไม่ได้</div>;
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5 rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
      <input type="hidden" name="requestId" value={requestId} />
      {state && (
        <div className={`rounded-lg px-4 py-3 font-medium ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {state.ok ? state.message : state.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="แมตช์" error={errorFor("matchId")} wide>
          <select name="matchId" value={matchId} disabled={pending} onChange={(event) => setMatchId(event.target.value)} className={inputClass}>
            {matches.map((match) => <option key={match.id} value={match.id}>{match.label} · {match.kickoffLabel}</option>)}
          </select>
          {selectedMatch && <span className="mt-1 block text-sm font-normal text-slate-500">{selectedMatch.venue || "ยังไม่กำหนดสนาม"}</span>}
        </Field>

        <Field label="โซน" error={errorFor("zone")}>
          <select name="zone" value={selectedZone?.code ?? ""} disabled={pending} onChange={(event) => setZoneCode(event.target.value)} className={inputClass}>
            {selectedMatch?.zones.map((zone) => (
              <option key={zone.code} value={zone.code} disabled={zone.remaining === 0}>{zone.name} · เหลือ {zone.remaining.toLocaleString("th-TH")} · {formatBaht(zone.price)}</option>
            ))}
          </select>
        </Field>
        <Field label="จำนวนบัตร" error={errorFor("quantity")}>
          <input name="quantity" type="number" min={1} max={selectedZone?.remaining} value={quantity} disabled={pending} onChange={(event) => setQuantity(Number(event.target.value))} className={inputClass} />
        </Field>

        <Field label="ชื่อลูกค้า" error={errorFor("customerName")}>
          <input name="customerName" required minLength={2} maxLength={100} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="เบอร์โทรศัพท์" error={errorFor("customerPhone")}>
          <input name="customerPhone" required inputMode="tel" maxLength={20} autoComplete="tel" placeholder="08xxxxxxxx" className={inputClass} />
        </Field>
        <Field label="อีเมล (ไม่บังคับ)" error={errorFor("customerEmail")}>
          <input name="customerEmail" type="email" maxLength={200} autoComplete="email" className={inputClass} />
        </Field>

        <Field label="การชำระเงิน" error={errorFor("paymentChoice")}>
          <select name="paymentChoice" value={paymentChoice} disabled={pending} onChange={(event) => setPaymentChoice(event.target.value)} className={inputClass}>
            <option value="PAY_LATER">ยังไม่ชำระ — สำรองที่นั่งชั่วคราว</option>
            <option value="OFFLINE_CASH">รับเงินสดแล้ว</option>
            <option value="OFFLINE_TRANSFER">ตรวจสอบเงินโอนแล้ว</option>
          </select>
        </Field>
        {paymentChoice === "PAY_LATER" ? (
          <Field label="ระยะเวลาสำรอง" error={errorFor("holdMinutes")}>
            <select name="holdMinutes" defaultValue="30" className={inputClass}>
              <option value="15">15 นาที</option><option value="30">30 นาที</option><option value="60">1 ชั่วโมง</option><option value="240">4 ชั่วโมง</option><option value="1440">1 วัน</option>
            </select>
          </Field>
        ) : (
          <input type="hidden" name="holdMinutes" value="30" />
        )}
        <Field label={paymentChoice === "OFFLINE_TRANSFER" ? "เลขอ้างอิงการโอน" : "เลขที่ใบเสร็จ (ไม่บังคับ)"} error={errorFor("offlineReceiptNo")}>
          <input name="offlineReceiptNo" required={paymentChoice === "OFFLINE_TRANSFER"} maxLength={100} className={inputClass} />
        </Field>
        <Field label="หมายเหตุ (ไม่บังคับ)" error={errorFor("notes")} wide>
          <textarea name="notes" rows={3} maxLength={500} className={inputClass} />
        </Field>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="font-bold">{selectedZone?.name}</p><p className="text-sm">คงเหลือ {selectedZone?.remaining.toLocaleString("th-TH")} ที่นั่ง</p></div>
          <div className="text-right"><p className="text-sm">ยอดที่ระบบคำนวณ</p><p className="text-3xl font-black">{formatBaht((selectedZone?.price ?? 0) * Math.max(0, quantity || 0))}</p></div>
        </div>
      </div>

      <label className={`flex items-start gap-3 rounded-lg border p-4 ${state && !state.ok && state.duplicate ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
        <input type="checkbox" name="confirmDuplicate" className="mt-1 size-4" />
        <span><strong className="block text-slate-800">ยืนยันสร้างรายการซ้ำ</strong><span className="text-sm text-slate-600">เลือกเฉพาะเมื่อระบบแจ้งว่าลูกค้ามีรายการเดิม และตรวจสอบแล้วว่าต้องการบัตรเพิ่มจริง</span></span>
      </label>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ระบบจะตรวจราคา จำนวนที่นั่ง รายการซ้ำ และสิทธิ์ผู้ใช้งานอีกครั้งที่เซิร์ฟเวอร์ รายการรับเงินแล้วจะยืนยันและตัดที่นั่งทันที</div>
      <button type="submit" disabled={pending || !requestId || !selectedZone || selectedZone.remaining === 0} className="rounded-lg bg-green-800 px-5 py-3 text-lg font-bold text-yellow-300 hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "กำลังตรวจสอบและบันทึก..." : "ยืนยันการจองโดยทีมงาน"}
      </button>
    </form>
  );
}

function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`block text-base font-semibold text-slate-800 ${wide ? "md:col-span-2" : ""}`}>{label}{children}{error && <span className="mt-1 block text-sm font-normal text-red-600">{error}</span>}</label>;
}
