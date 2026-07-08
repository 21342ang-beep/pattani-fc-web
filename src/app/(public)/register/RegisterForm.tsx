"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  registerCustomer,
  type CustomerAuthState,
} from "@/app/actions/customer-auth";
import PasswordInput from "@/components/PasswordInput";

// การสมัครมี 3 flow — email/password, Google, Line
// PDPA checkbox 1 อันคุมทั้งหมด (client-side state) + hidden input ในแต่ละ form
// ปุ่ม social โชว์ตลอด — ถ้า env ยังไม่ตั้ง จะเด้งกลับพร้อม error msg
export default function RegisterForm({
  errorMessage,
}: {
  errorMessage?: string;
}) {
  const [pdpaChecked, setPdpaChecked] = useState(false);
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(
    registerCustomer,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <div className="space-y-4">
      {(state?.error || errorMessage) && !state?.fieldErrors && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage || state?.error}
        </p>
      )}

      {/* ─── PDPA + OAuth buttons ─── */}
      <div>
        <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={pdpaChecked}
            onChange={(e) => setPdpaChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-green-700"
          />
          <span className="text-slate-700">
            ฉันยอมรับ{" "}
            <Link
              href="/privacy-policy"
              target="_blank"
              className="font-semibold text-green-800 hover:underline"
            >
              นโยบายความเป็นส่วนตัว (PDPA)
            </Link>{" "}
            และให้ Pattani FC เก็บและใช้ข้อมูลตามที่ระบุ
          </span>
        </label>
        {fe.pdpaConsent && (
          <p className="mt-1 text-xs text-red-600">{fe.pdpaConsent}</p>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <form method="POST" action="/api/auth/google/start">
            <input type="hidden" name="intent" value="register" />
            <input
              type="hidden"
              name="pdpaConsent"
              value={pdpaChecked ? "on" : ""}
            />
            <SocialButton
              disabled={!pdpaChecked}
              label="สมัครด้วย Google"
              bg="bg-white hover:bg-slate-50"
              border="border-slate-300"
              text="text-slate-800"
              iconSlot={<GoogleIcon />}
            />
          </form>
          <form method="POST" action="/api/auth/line/start">
            <input type="hidden" name="intent" value="register" />
            <input
              type="hidden"
              name="pdpaConsent"
              value={pdpaChecked ? "on" : ""}
            />
            <SocialButton
              disabled={!pdpaChecked}
              label="สมัครด้วย LINE"
              bg="bg-[#06C755] hover:bg-[#05a848]"
              border="border-transparent"
              text="text-white"
              iconSlot={<LineIcon />}
            />
          </form>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-500">หรือสมัครด้วยอีเมล</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* ─── Email / password form ─── */}
      <form action={formAction} className="space-y-3.5">
        <input
          type="hidden"
          name="pdpaConsent"
          value={pdpaChecked ? "on" : ""}
        />
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

        <button
          type="submit"
          disabled={pending || !pdpaChecked}
          suppressHydrationWarning
          className="w-full rounded-md bg-green-800 px-4 py-2.5 text-sm font-bold text-yellow-300 transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white"
        >
          {pending ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>

        {!pdpaChecked && (
          <p className="text-center text-[11px] text-slate-500">
            กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร
          </p>
        )}
      </form>
    </div>
  );
}

function SocialButton({
  label,
  disabled,
  bg,
  border,
  text,
  iconSlot,
}: {
  label: string;
  disabled: boolean;
  bg: string;
  border: string;
  text: string;
  iconSlot: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-md border ${border} ${bg} ${text} px-3 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {iconSlot}
      <span>{label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2C6.48 2 2 5.86 2 10.6c0 4.24 3.62 7.78 8.5 8.45.33.07.79.22.9.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.02.9.55 1.1-.46 5.93-3.49 8.09-5.97C21.63 14.15 22 12.42 22 10.6 22 5.86 17.52 2 12 2z" />
    </svg>
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
      <label className="block text-sm font-medium text-green-900">{label}</label>
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
