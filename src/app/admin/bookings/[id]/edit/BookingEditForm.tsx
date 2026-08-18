"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateBookingDetails, type BookingEditState } from "@/app/actions/booking-edits";
import { formatBaht } from "@/lib/format";

type BookingValue = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  zone: string;
  quantity: number;
  totalAmountLabel: string;
  status: string;
  salesChannel: string;
};

export default function BookingEditForm({
  booking,
  zones,
  canEditInventory,
}: {
  booking: BookingValue;
  zones: { code: string; name: string; price: number }[];
  canEditInventory: boolean;
}) {
  const [state, formAction, pending] = useActionState<BookingEditState, FormData>(updateBookingDetails, undefined);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.replace(`/admin/bookings/${booking.id}`);
  }, [booking.id, router, state]);
  const errorFor = (field: string) => state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
  const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:bg-slate-100";

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm md:p-6">
      <input type="hidden" name="bookingId" value={booking.id} />
      {state && !state.ok && <div className="rounded-lg bg-red-50 px-4 py-3 font-medium text-red-700">{state.error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="ชื่อลูกค้า" error={errorFor("customerName")}>
          <input name="customerName" required minLength={2} maxLength={100} defaultValue={booking.customerName} disabled={pending} className={inputClass} />
        </Field>
        <Field label="เบอร์โทรศัพท์" error={errorFor("customerPhone")}>
          <input name="customerPhone" required maxLength={20} inputMode="tel" defaultValue={booking.customerPhone} disabled={pending} className={inputClass} />
        </Field>
        <Field label="อีเมล (ไม่บังคับ)" error={errorFor("customerEmail")}>
          <input name="customerEmail" type="email" maxLength={200} defaultValue={booking.customerEmail} disabled={pending} className={inputClass} />
        </Field>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p><strong>สถานะ:</strong> {booking.status}</p>
          <p className="mt-1"><strong>ช่องทาง:</strong> {booking.salesChannel === "STAFF" ? "จองโดยทีมงาน" : "เว็บไซต์"}</p>
        </div>
      </div>

      {canEditInventory ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">แก้ไขโซนและจำนวนได้ เพราะเป็นรายการทีมงานที่ยังรอชำระ</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="โซน" error={errorFor("zone")}>
              <select name="zone" defaultValue={booking.zone} disabled={pending} className={inputClass}>
                {zones.map((zone) => <option key={zone.code} value={zone.code}>{zone.name} · {formatBaht(zone.price)}</option>)}
              </select>
            </Field>
            <Field label="จำนวนบัตร" error={errorFor("quantity")}>
              <input name="quantity" type="number" min={1} max={20} defaultValue={booking.quantity} disabled={pending} className={inputClass} />
            </Field>
          </div>
          <p className="mt-3 text-sm text-amber-900">เมื่อบันทึก ระบบจะตรวจที่นั่งอีกครั้งและคำนวณยอดใหม่จากราคาปัจจุบัน</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          <input type="hidden" name="zone" value={booking.zone} />
          <input type="hidden" name="quantity" value={booking.quantity} />
          <strong>โซน จำนวนบัตร และยอดเงินถูกล็อก</strong>
          <p className="mt-1 text-sm">โซน {booking.zone || "—"} · {booking.quantity} ใบ · {booking.totalAmountLabel}</p>
        </div>
      )}

      <Field label="หมายเหตุ (ไม่บังคับ)" error={errorFor("notes")}>
        <textarea name="notes" rows={3} maxLength={500} defaultValue={booking.notes} disabled={pending} className={inputClass} />
      </Field>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-green-800 px-5 py-3 font-bold text-yellow-300 hover:bg-green-900 disabled:opacity-50">
          {pending ? "กำลังตรวจสอบและบันทึก..." : "บันทึกการแก้ไข"}
        </button>
        <button type="button" disabled={pending} onClick={() => router.push(`/admin/bookings/${booking.id}`)} className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block font-semibold text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-red-600">{error}</span>}</label>;
}
