"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  deleteAccount,
  type ProfileState,
} from "@/app/actions/customer-profile";
import PasswordInput from "@/components/PasswordInput";

export default function DangerZone() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    deleteAccount,
    undefined
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <section className="mt-10 rounded-2xl border border-red-200 bg-red-50/50 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-6 shrink-0 text-red-600" />
        <div className="flex-1">
          <h2 className="text-lg font-bold text-red-900">เขตอันตราย</h2>
          <p className="mt-1 text-sm text-red-700">
            การลบบัญชีจะลบข้อมูลสมาชิกของคุณถาวร — การจองตั๋วที่ผ่านมายังคงอยู่ในระบบ
            (ข้อกำหนดทางบัญชี) แต่จะไม่สามารถเข้าสู่ระบบด้วยอีเมลนี้ได้อีก
          </p>

          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              ลบบัญชีของฉัน
            </button>
          ) : (
            <form action={formAction} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-red-900">
                  พิมพ์ <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono">DELETE</code> เพื่อยืนยัน
                </label>
                <input
                  name="confirm"
                  type="text"
                  required
                  autoComplete="off"
                  suppressHydrationWarning
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm uppercase outline-none focus:ring-2 ${
                    fe.confirm
                      ? "border-red-400 focus:border-red-600 focus:ring-red-500/20"
                      : "border-red-200 bg-white focus:border-red-500 focus:ring-red-500/20"
                  }`}
                />
                {fe.confirm && (
                  <p className="mt-1 text-xs text-red-600">{fe.confirm}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-red-900">
                  รหัสผ่าน
                </label>
                <div className="mt-1">
                  <PasswordInput
                    name="password"
                    required
                    autoComplete="current-password"
                    tone="red"
                    invalid={!!fe.password}
                  />
                </div>
                {fe.password && (
                  <p className="mt-1 text-xs text-red-600">{fe.password}</p>
                )}
              </div>

              {state?.error && !state.fieldErrors && (
                <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
                  {state.error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  suppressHydrationWarning
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {pending ? "กำลังลบ..." : "ลบบัญชีถาวร"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
