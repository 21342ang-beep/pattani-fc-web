"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  changeConfirmedBookingZone,
  type BookingZoneChangeState,
} from "@/app/actions/booking-zone-change";

type ZoneOption = {
  code: string;
  name: string;
  priceLabel: string;
  remaining: number;
};

export default function BookingZoneChangeForm({
  bookingId,
  currentZone,
  quantity,
  zones,
}: {
  bookingId: string;
  currentZone: string;
  quantity: number;
  zones: ZoneOption[];
}) {
  const [state, formAction, pending] = useActionState<BookingZoneChangeState, FormData>(
    changeConfirmedBookingZone,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.replace(`/admin/bookings/${bookingId}`);
  }, [bookingId, router, state]);

  const errorFor = (field: string) =>
    state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm md:p-6">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state && !state.ok && (
        <div aria-live="polite" className="rounded-lg bg-red-50 px-4 py-3 font-medium text-red-700">
          {state.error}
        </div>
      )}

      <label className="block font-semibold text-slate-800">
        โซนใหม่
        <select
          name="targetZone"
          required
          disabled={pending || zones.length === 0}
          defaultValue=""
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:bg-slate-100"
        >
          <option value="" disabled>เลือกโซนราคาเท่ากัน</option>
          {zones.map((zone) => (
            <option key={zone.code} value={zone.code}>
              {zone.name} · {zone.priceLabel} · เหลือ {zone.remaining.toLocaleString("th-TH")} ที่
            </option>
          ))}
        </select>
        {errorFor("targetZone") && <span className="mt-1 block text-sm font-normal text-red-600">{errorFor("targetZone")}</span>}
      </label>

      <label className="block font-semibold text-slate-800">
        เหตุผลที่เปลี่ยนโซน
        <textarea
          name="reason"
          required
          minLength={5}
          maxLength={300}
          rows={3}
          disabled={pending}
          placeholder="เช่น ลูกค้าเลือกโซนผิดและยืนยันขอเปลี่ยน"
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:bg-slate-100"
        />
        {errorFor("reason") && <span className="mt-1 block text-sm font-normal text-red-600">{errorFor("reason")}</span>}
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <input
          type="checkbox"
          name="confirmation"
          value="yes"
          required
          disabled={pending}
          className="mt-1 size-4 shrink-0"
        />
        <span>
          <strong>ยืนยันเปลี่ยน {quantity.toLocaleString("th-TH")} ใบจากโซน {currentZone}</strong>
          <span className="mt-1 block text-sm">ระบบจะคงรหัสตั๋ว ยอดชำระ และสถานะเดิม ลูกค้าต้องเปิดหรือบันทึก E-ticket ใหม่</span>
        </span>
      </label>
      {errorFor("confirmation") && <p className="text-sm text-red-600">{errorFor("confirmation")}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || zones.length === 0}
          className="rounded-lg bg-violet-700 px-5 py-3 font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "กำลังตรวจสอบและเปลี่ยนโซน..." : "ยืนยันเปลี่ยนโซน"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => router.push(`/admin/bookings/${bookingId}`)}
          className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
