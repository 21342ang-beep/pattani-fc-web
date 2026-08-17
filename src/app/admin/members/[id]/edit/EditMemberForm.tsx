"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateMember, type MemberFormState } from "@/app/actions/member-admin";
import PasswordInput from "@/components/PasswordInput";

type Props = {
  memberId: string;
  name: string;
  email: string;
  phone: string;
  hasPassword: boolean;
};

export default function EditMemberForm({
  memberId,
  name,
  email,
  phone,
  hasPassword,
}: Props) {
  const boundAction = updateMember.bind(null, memberId);
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(
    boundAction,
    undefined,
  );
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-green-900">ข้อมูลสมาชิกและการเข้าสู่ระบบ</h2>
        <p className="mt-1 text-sm text-slate-500">
          หากเปลี่ยนอีเมลหรือเบอร์โทร ระบบจะยกเลิกสถานะยืนยันของข้อมูลเดิม
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="ชื่อ-นามสกุล" error={state?.fieldErrors?.name?.[0]}>
              <input
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                defaultValue={name}
                autoComplete="off"
                className="w-full rounded-lg border border-green-200 px-4 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              />
            </Field>
          </div>

          <Field label="อีเมล" error={state?.fieldErrors?.email?.[0]}>
            <input
              name="email"
              type="email"
              required
              maxLength={200}
              defaultValue={email}
              autoComplete="off"
              className="w-full rounded-lg border border-green-200 px-4 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            />
          </Field>

          <Field label="เบอร์โทรศัพท์" error={state?.fieldErrors?.phone?.[0]}>
            <input
              name="phone"
              type="tel"
              maxLength={20}
              defaultValue={phone}
              placeholder="เช่น 0812345678"
              autoComplete="off"
              className="w-full rounded-lg border border-green-200 px-4 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-green-900">ตั้งรหัสผ่านใหม่</h2>
        <p className="mt-1 text-sm text-slate-500">
          {hasPassword
            ? "ระบบไม่สามารถแสดงรหัสผ่านเดิมได้ เว้นว่างไว้หากไม่ต้องการเปลี่ยน"
            : "บัญชีนี้ยังไม่มีรหัสผ่าน กรอกข้อมูลด้านล่างเพื่อเปิดใช้การเข้าสู่ระบบด้วยอีเมลหรือเบอร์โทร"}
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="รหัสผ่านใหม่" error={state?.fieldErrors?.password?.[0]}>
            <PasswordInput
              ref={passwordRef}
              name="password"
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />
          </Field>

          <Field label="ยืนยันรหัสผ่านใหม่" error={state?.fieldErrors?.confirmPassword?.[0]}>
            <PasswordInput
              ref={confirmPasswordRef}
              name="confirmPassword"
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              placeholder="กรอกให้ตรงกับรหัสผ่านใหม่"
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-800 px-6 py-3 text-base font-bold text-yellow-300 shadow-sm hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
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
    <label>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
