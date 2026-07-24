"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, UserPlus, User } from "lucide-react";
import { createBooking, type BookingFormState } from "@/app/actions/bookings";
import { formatBaht } from "@/lib/format";

export default function BookingForm({
  matchId,
  pricePerSeat,
  maxQuantity,
  customerEmail,
  customerName,
  customerPhone,
  zone,
}: {
  matchId: string;
  pricePerSeat: number;
  maxQuantity: number;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string;
  zone?: string;
}) {
  const isGuest = !customerEmail;
  // จองสำเร็จ → server action redirect ไป /checkout ทันที (ไม่มี success state ให้ handle)
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    createBooking,
    undefined
  );

  return (
    <form action={formAction} className="mt-6 space-y-5 rounded-lg border bg-white p-7 shadow-sm md:space-y-6 md:p-8">
      <h2 className="text-2xl font-semibold text-green-900 md:text-3xl">จองตั๋ว</h2>
      <input type="hidden" name="matchId" value={matchId} />
      {zone && <input type="hidden" name="zone" value={zone} />}

      {/* แสดง mode: member (จองในนามบัญชี) vs guest (จองในนามแขก) */}
      {isGuest ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-base md:text-lg">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 md:text-base">
            <User className="size-4" /> จองในนามแขก (ไม่ต้องสมัครสมาชิก)
          </span>
          <p className="mt-1 text-base leading-relaxed text-slate-600 md:text-lg">
            ใช้รหัสการจอง + เบอร์โทรในการตรวจสอบสถานะภายหลัง — หรือ{" "}
            <Link
              href="/register"
              className="inline-flex items-center gap-1 font-bold text-green-800 underline hover:text-green-900"
            >
              <UserPlus className="size-4" /> สมัครสมาชิกฟรี
            </Link>
            {" "}เพื่อรับสิทธิประโยชน์เพิ่ม
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-base md:text-lg">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-700 md:text-base">
            <Mail className="size-4" /> จองในนามบัญชี
          </span>
          <p className="mt-0.5 font-medium text-emerald-900">{customerEmail}</p>
        </div>
      )}

      {zone && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-base md:text-lg">
          <span className="text-sm font-semibold uppercase tracking-wider text-yellow-700 md:text-base">
            โซนที่เลือก
          </span>
          <p className="mt-0.5 font-bold text-yellow-900">{zone}</p>
        </div>
      )}

      <Field
        label="ชื่อ-นามสกุล"
        name="customerName"
        defaultValue={customerName}
        required
        errors={state?.fieldErrors?.customerName}
      />
      <Field
        label="เบอร์โทร"
        name="customerPhone"
        defaultValue={customerPhone}
        required
        errors={state?.fieldErrors?.customerPhone}
      />

      <div>
        <label className="block text-base font-medium md:text-lg">จำนวน (สูงสุด {maxQuantity})</label>
        <input
          name="quantity"
          type="number"
          min={1}
          max={maxQuantity}
          defaultValue={1}
          required
          className="mt-2 w-full rounded-md border px-4 py-3 text-base md:text-lg"
        />
        {state?.fieldErrors?.quantity && (
          <p className="mt-1 text-sm text-red-600 md:text-base">{state.fieldErrors.quantity[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-base font-medium md:text-lg">หมายเหตุ (ถ้ามี)</label>
        <textarea name="notes" rows={2} className="mt-2 w-full rounded-md border px-4 py-3 text-base md:text-lg" />
      </div>

      <p className="text-base text-slate-600 md:text-lg">ราคา {formatBaht(pricePerSeat)}/ใบ</p>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-base text-red-700 md:text-lg">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-5 py-3.5 text-base font-medium text-white hover:bg-slate-700 disabled:bg-slate-400 md:text-lg"
      >
        {pending ? "กำลังจอง..." : "จองและชำระเงิน"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div>
      <label className="block text-base font-medium md:text-lg">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-md border px-4 py-3 text-base md:text-lg"
      />
      {errors && <p className="mt-1 text-sm text-red-600 md:text-base">{errors[0]}</p>}
    </div>
  );
}
