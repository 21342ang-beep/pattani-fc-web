"use client";

import { useActionState } from "react";
import {
  updateProfile,
  type ProfileState,
} from "@/app/actions/customer-profile";

export default function ProfileForm({
  defaults,
}: {
  defaults: { name: string; email: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-green-900">อีเมล</label>
        <input
          type="email"
          defaultValue={defaults.email}
          readOnly
          disabled
          className="mt-1 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-green-900">
          ชื่อ-นามสกุล
        </label>
        <input
          name="name"
          type="text"
          defaultValue={defaults.name}
          required
          suppressHydrationWarning
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 ${
            fe.name
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-green-200 focus:border-green-600 focus:ring-green-600/20"
          }`}
        />
        {fe.name && <p className="mt-1 text-xs text-red-600">{fe.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-green-900">
          เบอร์โทร
        </label>
        <input
          name="phone"
          type="tel"
          defaultValue={defaults.phone}
          suppressHydrationWarning
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 ${
            fe.phone
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-green-200 focus:border-green-600 focus:ring-green-600/20"
          }`}
        />
        {fe.phone && <p className="mt-1 text-xs text-red-600">{fe.phone}</p>}
      </div>

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
        {pending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
