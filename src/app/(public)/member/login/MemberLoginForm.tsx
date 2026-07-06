"use client";

import { useActionState } from "react";
import {
  loginCustomer,
  type CustomerAuthState,
} from "@/app/actions/customer-auth";
import PasswordInput from "@/components/PasswordInput";

export default function MemberLoginForm() {
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(
    loginCustomer,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-green-900">อีเมล</label>
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
        <label className="block text-sm font-medium text-green-900">รหัสผ่าน</label>
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
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
