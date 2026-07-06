"use client";

import { useActionState } from "react";
import {
  changePassword,
  type ChangePasswordState,
} from "@/app/actions/profile";
import PasswordInput from "@/components/PasswordInput";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field
        name="currentPassword"
        label="รหัสผ่านปัจจุบัน"
        autoComplete="current-password"
        error={state?.fieldErrors?.currentPassword?.[0]}
      />
      <Field
        name="newPassword"
        label="รหัสผ่านใหม่"
        autoComplete="new-password"
        error={state?.fieldErrors?.newPassword?.[0]}
      />
      <Field
        name="confirmPassword"
        label="ยืนยันรหัสผ่านใหม่"
        autoComplete="new-password"
        error={state?.fieldErrors?.confirmPassword?.[0]}
      />

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          เปลี่ยนรหัสผ่านเรียบร้อยแล้ว
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        suppressHydrationWarning
        className="rounded-md bg-green-800 px-4 py-2.5 text-sm font-semibold text-yellow-300 hover:bg-green-900 disabled:bg-slate-400 disabled:text-white"
      >
        {pending ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  autoComplete,
  error,
}: {
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-green-900">{label}</label>
      <div className="mt-1">
        <PasswordInput
          name={name}
          autoComplete={autoComplete}
          required
          invalid={!!error}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
