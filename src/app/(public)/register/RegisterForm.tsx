"use client";

import { useActionState } from "react";
import {
  registerCustomer,
  type CustomerAuthState,
} from "@/app/actions/customer-auth";
import PasswordInput from "@/components/PasswordInput";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(
    registerCustomer,
    undefined
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3.5">
      <Field
        label="ชื่อ-นามสกุล"
        name="name"
        type="text"
        autoComplete="name"
        required
        error={fe.name}
      />
      <Field
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={fe.email}
      />
      <Field
        label="เบอร์โทร (ไม่บังคับ)"
        name="phone"
        type="tel"
        autoComplete="tel"
        error={fe.phone}
      />
      <PasswordField
        label="รหัสผ่าน"
        name="password"
        autoComplete="new-password"
        required
        hint="อย่างน้อย 8 ตัวอักษร + ต้องมีตัวอักษรและตัวเลข"
        error={fe.password}
      />
      <PasswordField
        label="ยืนยันรหัสผ่าน"
        name="confirmPassword"
        autoComplete="new-password"
        required
        error={fe.confirmPassword}
      />

      {state?.error && !state.fieldErrors && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        suppressHydrationWarning
        className="w-full rounded-md bg-green-800 px-4 py-2.5 text-sm font-bold text-yellow-300 transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white"
      >
        {pending ? "กำลังสมัคร..." : "สมัครสมาชิก"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        การสมัครสมาชิกแสดงว่าคุณยอมรับ
        <br />
        ข้อกำหนดและนโยบายความเป็นส่วนตัวของ Pattani FC
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-green-900">
        {label}
      </label>
      <input
        {...input}
        suppressHydrationWarning
        className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
            : "border-green-200 focus:border-green-600 focus:ring-green-600/20"
        }`}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function PasswordField({
  label,
  hint,
  error,
  ...input
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-green-900">
        {label}
      </label>
      <div className="mt-1">
        <PasswordInput {...input} invalid={!!error} />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
