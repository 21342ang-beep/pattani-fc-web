"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelCustomerRegistrationChallenge,
  registerCustomer,
  verifyCustomerRegistrationOtp,
  type CustomerAuthState,
} from "@/app/actions/customer-auth";
import PasswordInput from "@/components/PasswordInput";
import TurnstileWidget from "./TurnstileWidget";

export type ShippingProvince = {
  name: string;
  districts: { name: string; postalCodes: string[] }[];
};

// สมัครสมาชิกด้วยอีเมลและรหัสผ่าน
export default function RegisterForm({
  errorMessage,
  shippingProvinces,
  returnTo,
  turnstileSiteKey,
}: {
  errorMessage?: string;
  shippingProvinces: ShippingProvince[];
  returnTo?: string;
  turnstileSiteKey?: string;
}) {
  const [pdpaChecked, setPdpaChecked] = useState(false);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [phoneVerification, setPhoneVerification] = useState<"skip" | "otp">("skip");
  const [resettingRegistration, startRegistrationReset] = useTransition();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(
    registerCustomer,
    undefined,
  );
  const [otpState, otpAction, verifyingOtp] = useActionState<
    CustomerAuthState,
    FormData
  >(verifyCustomerRegistrationOtp, undefined);
  const fe = state?.fieldErrors ?? {};
  const selectedProvince = shippingProvinces.find((item) => item.name === province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.name === district);

  useEffect(() => {
    if (state?.redirectTo) router.replace(state.redirectTo);
  }, [router, state?.redirectTo]);

  useEffect(() => {
    if (otpState?.redirectTo) router.replace(otpState.redirectTo);
  }, [otpState?.redirectTo, router]);

  useEffect(() => {
    if (!state) return;
    setTurnstileToken("");
    setTurnstileResetKey((value) => value + 1);
  }, [state]);

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

  if (state?.otpRequired) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-800">
            ขั้นตอนที่ 2 จาก 2
          </p>
          <h2 className="mt-1 text-xl font-black text-green-950">
            ยืนยันเบอร์มือถือด้วย OTP
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">
            ส่งรหัสไปที่ {state.maskedPhone ?? "เบอร์ที่กรอก"}
            {state.reference ? ` · Ref ${state.reference}` : ""}
          </p>
          <p className="mt-2 text-sm font-medium text-amber-900">
            บัญชียังไม่ถูกเปิดและยังไม่มีการเข้าสู่ระบบ จนกว่าจะยืนยันรหัสสำเร็จ
          </p>
        </div>

        <form action={otpAction} className="space-y-4">
          <div>
            <label className="block text-base font-semibold text-green-900">
              รหัส OTP <span className="text-sm text-red-600">* จำเป็น</span>
            </label>
            <input
              name="pin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              minLength={4}
              maxLength={8}
              autoComplete="one-time-code"
              required
              autoFocus
              className="mt-1.5 w-full rounded-md border border-green-200 px-4 py-3 text-center text-xl tracking-[0.35em] outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              placeholder="••••••"
            />
          </div>
          {otpState?.error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {otpState.error}
            </p>
          )}
          {otpState?.registered && (
            <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ยืนยันสำเร็จ กำลังเข้าสู่หน้าสมาชิก…
            </p>
          )}
          <button
            type="submit"
            disabled={verifyingOtp || Boolean(otpState?.registered)}
            className="w-full rounded-md bg-green-800 px-4 py-3 text-base font-bold text-yellow-300 transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white md:text-lg"
          >
            {verifyingOtp ? "กำลังยืนยัน..." : "ยืนยันและเปิดบัญชี"}
          </button>
        </form>

        <button
          type="button"
          disabled={resettingRegistration || verifyingOtp}
          onClick={() => {
            startRegistrationReset(async () => {
              try {
                await cancelCustomerRegistrationChallenge();
              } finally {
                window.location.reload();
              }
            });
          }}
          className="w-full text-sm font-semibold text-green-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {resettingRegistration
            ? "กำลังล้างคำขอเดิม..."
            : "แก้เบอร์/ข้อมูล หรือขอ OTP ใหม่"}
        </button>
        <p className="text-center text-xs text-slate-500">
          รหัสและคำขอนี้หมดอายุภายใน 10 นาที การออกจากหน้านี้จะไม่สร้างบัญชีค้างไว้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(state?.error || errorMessage) && !state?.fieldErrors && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-base text-red-700">
          {errorMessage || state?.error}
        </p>
      )}

      <form action={formAction} className="space-y-3.5">
        <input
          type="hidden"
          name="pdpaConsent"
          value={pdpaChecked ? "on" : ""}
        />
        <input type="hidden" name="turnstileToken" value={turnstileToken} />
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
          hint="ไม่บังคับ — หากไม่กรอก สามารถเข้าสู่ระบบด้วยเบอร์โทรและรหัสผ่านได้"
          error={fe.email}
        />
        <Field
          label="เบอร์โทร"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          error={fe.phone}
        />
        <fieldset className="rounded-lg border border-green-200 bg-green-50/40 p-4">
          <legend className="px-1 text-base font-bold text-green-900 md:text-lg">
            การยืนยันเบอร์โทร <span className="text-sm font-normal text-slate-500">(เลือกได้)</span>
          </legend>
          <div className="mt-2 space-y-2.5">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-green-200 bg-white p-3.5">
              <input
                type="radio"
                name="phoneVerification"
                value="skip"
                checked={phoneVerification === "skip"}
                onChange={() => setPhoneVerification("skip")}
                className="mt-1 h-5 w-5 accent-green-700"
              />
              <span>
                <span className="block font-bold text-green-950">สมัครเลย ไม่ต้องยืนยัน OTP ตอนนี้</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">
                  สมัครและเข้าใช้งานได้ทันที ยืนยันเบอร์ภายหลังได้ที่หน้าโปรไฟล์
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-green-200 bg-white p-3.5">
              <input
                type="radio"
                name="phoneVerification"
                value="otp"
                checked={phoneVerification === "otp"}
                onChange={() => setPhoneVerification("otp")}
                className="mt-1 h-5 w-5 accent-green-700"
              />
              <span>
                <span className="block font-bold text-green-950">ยืนยันด้วย OTP ตอนนี้</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">
                  ใช้เบอร์ที่ยืนยันแล้วสำหรับกู้รหัสผ่านและยืนยันสิทธิ์ที่ผูกกับเบอร์โทร
                </span>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="เพศ" error={fe.gender} required>
            <select name="gender" required defaultValue="" className={selectClassName(!!fe.gender)} suppressHydrationWarning>
              <option value="" disabled>เลือกเพศ</option>
              <option value="MALE">ชาย</option>
              <option value="FEMALE">หญิง</option>
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
          <p className="text-base font-bold text-green-900 md:text-lg">ที่อยู่ตามบัตรประชาชน</p>
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
                <select name="province" value={province} onChange={(event) => handleProvinceChange(event.target.value)} required className={selectClassName(!!fe.province)} suppressHydrationWarning>
                  <option value="">เลือกจังหวัด</option>
                  {shippingProvinces.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </SelectField>
              <SelectField label="อำเภอ/เขต" error={fe.district} required>
                <select name="district" value={district} onChange={(event) => handleDistrictChange(event.target.value)} disabled={!selectedProvince} required className={selectClassName(!!fe.district)} suppressHydrationWarning>
                  <option value="">{selectedProvince ? "เลือกอำเภอ/เขต" : "เลือกจังหวัดก่อน"}</option>
                  {selectedProvince?.districts.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </SelectField>
            </div>
            <SelectField label="รหัสไปรษณีย์" error={fe.postalCode} required>
              <select name="postalCode" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} disabled={!selectedDistrict} required className={selectClassName(!!fe.postalCode)} suppressHydrationWarning>
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
          minLength={8}
          required
          hint="อย่างน้อย 8 ตัวอักษร สามารถใช้ตัวเลขอย่างเดียวได้"
          error={fe.password}
        />
        <PasswordField
          label="ยืนยันรหัสผ่าน"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          required
          error={fe.confirmPassword}
        />

        {/* ─── PDPA ─── */}
        <div>
          <label className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-base">
            <input
              type="checkbox"
              checked={pdpaChecked}
              onChange={(e) => setPdpaChecked(e.target.checked)}
              className="mt-1 h-5 w-5 accent-green-700"
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
            <p className="mt-1 text-sm text-red-600">{fe.pdpaConsent}</p>
          )}
        </div>

        {/* ─── สมัครด้วยรหัสผ่าน ─── */}
        {turnstileSiteKey && (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            resetKey={turnstileResetKey}
            onTokenChange={setTurnstileToken}
          />
        )}
        <button
          type="submit"
          name="mode"
          value="password"
          disabled={pending || !pdpaChecked || (!!turnstileSiteKey && !turnstileToken)}
          suppressHydrationWarning
          className="w-full rounded-md bg-green-800 px-4 py-3 text-base font-bold text-yellow-300 transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white md:text-lg"
        >
          {pending
            ? "กำลังดำเนินการ..."
            : phoneVerification === "otp"
              ? "สมัครและยืนยันด้วย OTP"
              : "สมัครสมาชิกทันที"}
        </button>

        {!pdpaChecked && (
          <p className="text-center text-sm text-slate-500">
            กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร
          </p>
        )}
      </form>
    </div>
  );
}

function selectClassName(invalid: boolean) {
  return `w-full rounded-md border bg-white px-4 py-3 text-base outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 md:text-lg ${
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
      <label className="block text-base font-semibold text-green-900 md:text-lg">
        {label} <RequirementLabel required={required} />
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
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
      <label className="block text-base font-semibold text-green-900 md:text-lg">
        {label} <RequirementLabel required={!!input.required} />
      </label>
      <input
        {...input}
        suppressHydrationWarning
        className={`mt-1.5 w-full rounded-md border px-4 py-3 text-base outline-none focus:ring-2 md:text-lg ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
            : "border-green-200 focus:border-green-600 focus:ring-green-600/20"
        }`}
      />
      {error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
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
      <label className="block text-base font-semibold text-green-900 md:text-lg">
        {label} <RequirementLabel required={!!input.required} />
      </label>
      <div className="mt-1.5">
        <PasswordInput {...input} invalid={!!error} className="px-4 py-3 text-base md:text-lg" />
      </div>
      {error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function RequirementLabel({ required }: { required: boolean }) {
  return required ? (
    <span className="text-sm font-semibold text-red-600">* จำเป็น</span>
  ) : (
    <span className="text-sm font-normal text-slate-400">(ไม่บังคับ)</span>
  );
}
