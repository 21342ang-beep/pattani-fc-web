"use client";

import { useActionState } from "react";
import {
  changePassword,
  type ProfileState,
} from "@/app/actions/customer-profile";
import PasswordInput from "@/components/PasswordInput";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    changePassword,
    undefined
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" key={state?.success ? "ok" : "form"}>
      <PasswordField
        label="รหัสผ่านปัจจุบัน"
        name="currentPassword"
        autoComplete="current-password"
        required
        error={fe.currentPassword}
      />
      <PasswordField
        label="รหัสผ่านใหม่"
        name="newPassword"
        autoComplete="new-password"
        required
        hint="อย่างน้อย 8 ตัวอักษร + ต้องมีตัวอักษรและตัวเลข"
        error={fe.newPassword}
      />
      <PasswordField
        label="ยืนยันรหัสผ่านใหม่"
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
        {pending ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
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
      <label className="block text-sm font-medium text-green-900">{label}</label>
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
