"use client";

import { useActionState } from "react";
import {
  loginCustomer,
  type CustomerAuthState,
} from "@/app/actions/customer-auth";
import PasswordInput from "@/components/PasswordInput";

export default function MemberLoginForm({
  errorMessage,
}: {
  errorMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(
    loginCustomer,
    undefined,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href="/api/auth/google/start"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <GoogleIcon />
          <span>Google</span>
        </a>
        <a
          href="/api/auth/line/start"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#06C755] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#05a848]"
        >
          <LineIcon />
          <span>LINE</span>
        </a>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-500">หรือ</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-green-900">
            อีเมล
          </label>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            suppressHydrationWarning
            className="mt-1 w-full rounded-md border border-green-200 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-green-900">
            รหัสผ่าน
          </label>
          <div className="mt-1">
            <PasswordInput
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
        </div>
        {state?.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          suppressHydrationWarning
          className="w-full rounded-md bg-green-800 px-4 py-2.5 text-sm font-semibold text-yellow-300 hover:bg-green-900 disabled:bg-slate-400 disabled:text-white"
        >
          {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วยอีเมล"}
        </button>
      </form>
    </div>
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
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 5.86 2 10.6c0 4.24 3.62 7.78 8.5 8.45.33.07.79.22.9.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.02.9.55 1.1-.46 5.93-3.49 8.09-5.97C21.63 14.15 22 12.42 22 10.6 22 5.86 17.52 2 12 2z" />
    </svg>
  );
}
