"use client";

import { useActionState } from "react";
import { requestCustomerPasswordReset, resetCustomerPassword, type PasswordResetState } from "@/app/actions/customer-password-reset";
import PasswordInput from "@/components/PasswordInput";

export default function ForgotPasswordForm() {
  const [requestState, requestAction, requesting] = useActionState<PasswordResetState, FormData>(requestCustomerPasswordReset, undefined);
  const [resetState, resetAction, resetting] = useActionState<PasswordResetState, FormData>(resetCustomerPassword, undefined);
  if (resetState?.reset) return <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-emerald-800">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ</p>;
  if (requestState?.requested) return <form action={resetAction} className="mt-6 space-y-4"><p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">ส่ง OTP แล้ว กรุณากรอกรหัสและตั้งรหัสผ่านใหม่</p><input name="pin" inputMode="numeric" autoComplete="one-time-code" required placeholder="รหัส OTP" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center tracking-[0.4em]" /><PasswordInput name="password" autoComplete="new-password" required placeholder="รหัสผ่านใหม่" /><PasswordInput name="confirmPassword" autoComplete="new-password" required placeholder="ยืนยันรหัสผ่านใหม่" />{resetState?.error && <p className="text-sm text-red-700">{resetState.error}</p>}<button disabled={resetting} className="w-full rounded-lg bg-green-800 py-3 font-bold text-yellow-300">{resetting ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}</button></form>;
  return <form action={requestAction} className="mt-6 space-y-4"><input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="เบอร์มือถือที่ใช้สมัคร" className="w-full rounded-lg border border-slate-300 px-4 py-3" />{requestState?.error && <p className="text-sm text-red-700">{requestState.error}</p>}<button disabled={requesting} className="w-full rounded-lg bg-green-800 py-3 font-bold text-yellow-300">{requesting ? "กำลังส่ง OTP..." : "ส่ง OTP"}</button></form>;
}
