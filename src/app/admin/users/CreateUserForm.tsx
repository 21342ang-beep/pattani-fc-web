"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createAdmin, type UserFormState } from "@/app/actions/users";
import PermissionCheckboxes from "./PermissionCheckboxes";

export default function CreateUserForm() {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    createAdmin,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setOpen(false);
      setRole("ADMIN");
    }
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-green-900"
      >
        + เพิ่มผู้ดูแลใหม่
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-green-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-green-900">
          เพิ่มผู้ดูแลใหม่
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ✕
        </button>
      </div>

      {state?.error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="อีเมล" error={state?.fieldErrors?.email?.[0]}>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="ชื่อ (ไม่บังคับ)" error={state?.fieldErrors?.name?.[0]}>
          <input
            name="name"
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field
          label="รหัสผ่านเริ่มต้น"
          error={state?.fieldErrors?.password?.[0]}
        >
          <input
            name="password"
            type="text"
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="Role" error={state?.fieldErrors?.role?.[0]}>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "SUPER_ADMIN")}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN (มีทุกสิทธิ์)</option>
          </select>
        </Field>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-slate-800">
          สิทธิ์เข้าถึงหมวด
          {role === "SUPER_ADMIN" && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              (SUPER_ADMIN เข้าถึงได้ทุกหมวดโดยอัตโนมัติ — checkbox นี้ไม่มีผล)
            </span>
          )}
        </p>
        <PermissionCheckboxes disabled={role === "SUPER_ADMIN"} />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-green-900 disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
