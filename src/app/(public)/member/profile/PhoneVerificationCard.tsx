"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  requestBookingSearchOtp,
  verifyBookingSearchOtp,
} from "@/app/actions/booking-search-otp";

export default function PhoneVerificationCard({
  phone,
  verifiedAtLabel,
}: {
  phone: string | null;
  verifiedAtLabel: string | null;
}) {
  const router = useRouter();
  const [requestState, requestAction, requesting] = useActionState(
    requestBookingSearchOtp,
    undefined,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyBookingSearchOtp,
    undefined,
  );

  useEffect(() => {
    if (
      verifyState &&
      "verified" in verifyState &&
      !verifyState.phoneLinkWarning
    ) {
      router.refresh();
    }
  }, [router, verifyState]);

  if (verifiedAtLabel) {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-bold text-emerald-900">✓ ยืนยันเบอร์โทรแล้ว</p>
        <p className="mt-1 text-sm text-emerald-800">
          เบอร์ {phone} · ยืนยันเมื่อ {verifiedAtLabel}
        </p>
      </section>
    );
  }

  if (!phone) {
    return (
      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="font-bold text-amber-900">ยังไม่มีเบอร์โทรในโปรไฟล์</p>
        <p className="mt-1 text-sm text-amber-800">
          เพิ่มเบอร์โทรในแบบฟอร์มด้านบนก่อน จึงจะยืนยันเบอร์ได้
        </p>
      </section>
    );
  }

  if (requestState && "requested" in requestState) {
    return (
      <section className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
        <h2 className="font-bold text-green-900">กรอกรหัส OTP</h2>
        <p className="mt-1 text-sm text-green-800">
          ส่งรหัสไปยัง {phone} แล้ว
          {requestState.reference ? ` · อ้างอิง ${requestState.reference}` : ""}
        </p>
        <form action={verifyAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="รหัส OTP"
            className="min-h-12 flex-1 rounded-lg border border-green-300 bg-white px-4 text-center text-lg tracking-[0.25em] outline-none focus:ring-2 focus:ring-green-600/25"
          />
          <button
            disabled={verifying}
            className="min-h-12 rounded-lg bg-green-800 px-6 font-bold text-yellow-300 disabled:opacity-60"
          >
            {verifying ? "กำลังยืนยัน..." : "ยืนยันเบอร์"}
          </button>
        </form>
        {verifyState && "error" in verifyState && (
          <p className="mt-2 text-sm text-red-700">{verifyState.error}</p>
        )}
        {verifyState &&
          "verified" in verifyState &&
          verifyState.phoneLinkWarning && (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {verifyState.phoneLinkWarning}
            </p>
          )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-bold text-amber-900">เบอร์โทรยังไม่ยืนยัน</h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-800">
        ไม่กระทบการใช้งานเดิม ยืนยันเมื่อพร้อมเพื่อเพิ่มความน่าเชื่อถือของบัญชี
        ระบบจะส่ง SMS เฉพาะเมื่อคุณกดปุ่มนี้เท่านั้น
      </p>
      <form action={requestAction} className="mt-4">
        <input type="hidden" name="customerPhone" value={phone} />
        <button
          disabled={requesting}
          className="min-h-12 rounded-lg bg-green-800 px-6 font-bold text-yellow-300 disabled:opacity-60"
        >
          {requesting ? "กำลังส่ง OTP..." : "ส่ง OTP เพื่อยืนยันเบอร์"}
        </button>
      </form>
      {requestState && "error" in requestState && (
        <p className="mt-2 text-sm text-red-700">{requestState.error}</p>
      )}
    </section>
  );
}
