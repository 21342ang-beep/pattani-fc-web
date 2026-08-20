"use client";

import { useActionState, useState } from "react";
import {
  updateProfile,
  type ProfileState,
} from "@/app/actions/customer-profile";
import PasswordInput from "@/components/PasswordInput";
import { isProfilePhoneChanged } from "@/lib/customer-profile-policy";

export default function ProfileForm({
  defaults,
  canChangePhone,
}: {
  defaults: { name: string; email: string; phone: string };
  canChangePhone: boolean;
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );
  const fe = state?.fieldErrors ?? {};
  const [phone, setPhone] = useState(defaults.phone);
  const phoneChanged = isProfilePhoneChanged(defaults.phone, phone);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-green-900">อีเมล</label>
        <input
          type="email"
          defaultValue={defaults.email}
          readOnly
          disabled
          className="mt-1 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-green-900">
          ชื่อ-นามสกุล
        </label>
        <input
          name="name"
          type="text"
          defaultValue={defaults.name}
          required
          suppressHydrationWarning
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 ${
            fe.name
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-green-200 focus:border-green-600 focus:ring-green-600/20"
          }`}
        />
        {fe.name && <p className="mt-1 text-xs text-red-600">{fe.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-green-900">
          เบอร์โทร
        </label>
        <input
          name="phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          readOnly={!canChangePhone}
          aria-describedby={!canChangePhone ? "phone-change-help" : undefined}
          suppressHydrationWarning
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 ${
            fe.phone
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : canChangePhone
                ? "border-green-200 focus:border-green-600 focus:ring-green-600/20"
                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
          }`}
        />
        {fe.phone && <p className="mt-1 text-xs text-red-600">{fe.phone}</p>}
        {!canChangePhone && (
          <p id="phone-change-help" className="mt-1 text-xs text-amber-700">
            บัญชี Google/LINE ที่ยังไม่มีรหัสผ่านเปลี่ยนเบอร์ด้วยตนเองไม่ได้
            กรุณาตั้งรหัสผ่านผ่านการกู้บัญชีที่ยืนยันแล้วหรือติดต่อทีมงาน
          </p>
        )}
      </div>

      {canChangePhone && phoneChanged && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <label className="block text-sm font-semibold text-amber-950">
            รหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนเบอร์
          </label>
          <div className="mt-2">
            <PasswordInput
              name="currentPassword"
              autoComplete="current-password"
              required
              invalid={Boolean(fe.currentPassword)}
              aria-describedby="phone-password-help"
            />
          </div>
          <p id="phone-password-help" className="mt-2 text-xs text-amber-800">
            เมื่อเปลี่ยนเบอร์ ระบบจะออกจากระบบอุปกรณ์อื่นและต้องยืนยันเบอร์ใหม่ด้วย OTP
          </p>
          {fe.currentPassword && (
            <p className="mt-1 text-xs text-red-600">{fe.currentPassword}</p>
          )}
        </div>
      )}

      {state?.error && !state.fieldErrors && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        suppressHydrationWarning
        className="rounded-md bg-green-800 px-5 py-2 text-sm font-bold text-yellow-300 transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white"
      >
        {pending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
