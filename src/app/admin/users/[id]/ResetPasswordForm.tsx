"use client";

import { useActionState, useEffect, useRef } from "react";
import { resetAdminPassword, type UserFormState } from "@/app/actions/users";

export default function ResetPasswordForm({ userId }: { userId: string }) {
  const boundAction = resetAdminPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    boundAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-1 text-base font-bold text-green-900">
        รีเซ็ตรหัสผ่าน
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        ตั้งรหัสผ่านใหม่ให้ผู้ดูแลรายนี้ — หลังรีเซ็ตแจ้งเจ้าตัวไปเปลี่ยนต่อเองที่ /admin/change-password
      </p>

      {state?.error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          รีเซ็ตรหัสผ่านเรียบร้อย
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            รหัสผ่านใหม่
          </span>
          <input
            name="password"
            type="text"
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
          {state?.fieldErrors?.password?.[0] && (
            <span className="mt-1 block text-xs text-red-600">
              {state.fieldErrors.password[0]}
            </span>
          )}
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "กำลังตั้ง..." : "ตั้งรหัสผ่าน"}
        </button>
      </div>
    </form>
  );
}
