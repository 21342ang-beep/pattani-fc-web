"use client";

import { useActionState } from "react";
import {
  loginCustomer,
  type CustomerAuthState,
} from "@/app/actions/customer-auth";
import PasswordInput from "@/components/PasswordInput";

export default function MemberLoginForm({
  errorMessage,
  returnTo,
}: {
  errorMessage?: string;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(
    loginCustomer,
    undefined,
  );

  return (
    <div className="space-y-4">
      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-base text-red-700">
          {errorMessage}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <div>
          <label className="block text-base font-semibold text-green-900 md:text-lg">
            อีเมลหรือเบอร์โทรศัพท์
          </label>
          <input
            name="identifier"
            type="text"
            autoComplete="username"
            required
            placeholder="อีเมล หรือเบอร์โทรที่ใช้สมัคร"
            suppressHydrationWarning
            className="mt-1.5 w-full rounded-md border border-green-200 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 md:text-lg"
          />
        </div>
        <div>
          <label className="block text-base font-semibold text-green-900 md:text-lg">
            รหัสผ่าน
          </label>
          <div className="mt-1.5">
            <PasswordInput
              name="password"
              autoComplete="current-password"
              required
              className="px-4 py-3 text-base md:text-lg"
            />
          </div>
        </div>
        <div className="-mt-1 text-right">
          <a href="/member/forgot-password" className="text-sm font-semibold text-green-800 hover:underline">ลืมรหัสผ่าน?</a>
        </div>
        {state?.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-base text-red-700">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          suppressHydrationWarning
          className="w-full rounded-md bg-green-800 px-4 py-3 text-base font-bold text-yellow-300 hover:bg-green-900 disabled:bg-slate-400 disabled:text-white md:text-lg"
        >
          {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
