"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  registerCustomer,
  type CustomerAuthState,
} from "@/app/actions/customer-auth";
import PasswordInput from "@/components/PasswordInput";

export type ShippingProvince = {
  name: string;
  districts: { name: string; postalCodes: string[] }[];
};

// สมัครสมาชิกด้วยอีเมลและรหัสผ่าน
export default function RegisterForm({
  errorMessage,
  shippingProvinces,
  returnTo,
}: {
  errorMessage?: string;
  shippingProvinces: ShippingProvince[];
  returnTo?: string;
}) {
  const [pdpaChecked, setPdpaChecked] = useState(false);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(
    registerCustomer,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const selectedProvince = shippingProvinces.find((item) => item.name === province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.name === district);

  function handleProvinceChange(value: string) {
    setProvince(value);
    setDistrict("");
    setPostalCode("");
  }

  function handleDistrictChange(value: string) {
    const nextDistrict = selectedProvince?.districts.find((item) => item.name === value);
    setDistrict(value);
    setPostalCode(nextDistrict?.postalCodes.length === 1 ? nextDistrict.postalCodes[0] : "");
  }

  return (
    <div className="space-y-4">
      {(state?.error || errorMessage) && !state?.fieldErrors && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage || state?.error}
        </p>
      )}

      <form action={formAction} className="space-y-3.5">
        <input
          type="hidden"
          name="pdpaConsent"
          value={pdpaChecked ? "on" : ""}
        />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        {/* ─── ข้อมูลลูกค้า ─── */}
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
          error={fe.email}
        />
        <Field
          label="เบอร์โทร (ไม่บังคับ)"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          error={fe.phone}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="เพศ" error={fe.gender} required>
            <select name="gender" required defaultValue="" className={selectClassName(!!fe.gender)}>
              <option value="" disabled>เลือกเพศ</option>
              <option value="MALE">ชาย</option>
              <option value="FEMALE">หญิง</option>
              <option value="NON_BINARY">ไม่ระบุเพศตามกำเนิด</option>
              <option value="PREFER_NOT_TO_SAY">ไม่ประสงค์ระบุ</option>
            </select>
          </SelectField>
          <SelectField label="ปีเกิด" error={fe.birthDate} required>
            <select name="birthDate" required defaultValue="" className={selectClassName(!!fe.birthDate)} suppressHydrationWarning>
              <option value="" disabled>เลือกปีเกิด</option>
              {Array.from({ length: 101 }, (_, index) => {
                const year = new Date().getFullYear() - index;
                return <option key={year} value={`${year}-01-01`}>{year}</option>;
              })}
            </select>
          </SelectField>
        </div>
        <div className="rounded-lg border border-green-100 bg-green-50/40 p-4">
          <p className="text-sm font-bold text-green-900">ที่อยู่ตามบัตรประชาชน</p>
          <div className="mt-3 space-y-3">
            <Field
              label="ที่อยู่"
              name="address"
              type="text"
              autoComplete="street-address"
              placeholder="บ้านเลขที่ / หมู่ / ซอย / ถนน"
              required
              error={fe.address}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="จังหวัด" error={fe.province} required>
                <select name="province" value={province} onChange={(event) => handleProvinceChange(event.target.value)} required className={selectClassName(!!fe.province)}>
                  <option value="">เลือกจังหวัด</option>
                  {shippingProvinces.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </SelectField>
              <SelectField label="อำเภอ/เขต" error={fe.district} required>
                <select name="district" value={district} onChange={(event) => handleDistrictChange(event.target.value)} disabled={!selectedProvince} required className={selectClassName(!!fe.district)}>
                  <option value="">{selectedProvince ? "เลือกอำเภอ/เขต" : "เลือกจังหวัดก่อน"}</option>
                  {selectedProvince?.districts.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </SelectField>
            </div>
            <SelectField label="รหัสไปรษณีย์" error={fe.postalCode} required>
              <select name="postalCode" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} disabled={!selectedDistrict} required className={selectClassName(!!fe.postalCode)}>
                <option value="">{selectedDistrict ? "เลือกรหัสไปรษณีย์" : "เลือกอำเภอก่อน"}</option>
                {selectedDistrict?.postalCodes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </SelectField>
          </div>
        </div>
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

        {/* ─── PDPA ─── */}
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
        </div>

        {/* ─── สมัครด้วยรหัสผ่าน ─── */}
        <button
          type="submit"
          name="mode"
          value="password"
          disabled={pending || !pdpaChecked}
          suppressHydrationWarning
          className="w-full rounded-md bg-green-800 px-4 py-2.5 text-sm font-bold text-yellow-300 transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white"
        >
          {pending ? "กำลังดำเนินการ..." : "สมัครสมาชิก"}
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

function selectClassName(invalid: boolean) {
  return `w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${
    invalid
      ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
      : "border-green-200 focus:border-green-600 focus:ring-green-600/20"
  }`;
}

function SelectField({
  label,
  error,
  required = false,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-green-900">
        {label} <RequirementLabel required={required} />
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
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
      <label className="block text-sm font-medium text-green-900">
        {label} <RequirementLabel required={!!input.required} />
      </label>
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
      <label className="block text-sm font-medium text-green-900">
        {label} <RequirementLabel required={!!input.required} />
      </label>
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

function RequirementLabel({ required }: { required: boolean }) {
  return required ? (
    <span className="text-xs font-semibold text-red-600">* จำเป็น</span>
  ) : (
    <span className="text-xs font-normal text-slate-400">(ไม่บังคับ)</span>
  );
}
