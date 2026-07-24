"use client";

import { useActionState, useState } from "react";
import { Search, ShieldCheck, Ticket } from "lucide-react";
import {
  requestBookingSearchOtp,
  type RequestBookingSearchOtpState,
  type SeasonPassSearchResult,
  type VerifyBookingSearchOtpState,
  verifyBookingSearchOtp,
} from "@/app/actions/booking-search-otp";
import { formatDateTime } from "@/lib/format";

export default function SeasonPassSearchForm() {
  const [requestState, requestAction, requesting] = useActionState<
    RequestBookingSearchOtpState,
    FormData
  >(requestBookingSearchOtp, undefined);
  const [verifyState, verifyAction, verifying] = useActionState<
    VerifyBookingSearchOtpState,
    FormData
  >(verifyBookingSearchOtp, undefined);
  const [startOver, setStartOver] = useState(false);

  const request = !startOver && requestState && "requested" in requestState && requestState.target === "season"
    ? requestState
    : null;
  const results = verifyState && "results" in verifyState && verifyState.target === "season"
    ? verifyState.results
    : null;

  if (results) return <SeasonPassResults results={results} onStartOver={() => setStartOver(true)} />;

  if (request) {
    return (
      <section className="mt-7 rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
        <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4 text-green-900">
          <ShieldCheck className="mt-0.5 size-6 shrink-0" />
          <div>
            <h2 className="text-xl font-black md:text-2xl">ยืนยันรหัส OTP</h2>
            <p className="mt-1 text-base text-green-800 md:text-lg">
              ส่งรหัสไปยัง {maskPhone(request.phone)} แล้ว
              {request.reference ? ` · Ref: ${request.reference}` : ""}
            </p>
          </div>
        </div>

        <form action={verifyAction} className="mt-6 space-y-5">
          <input type="hidden" name="customerName" value={request.customerName} />
          <input type="hidden" name="target" value="season" />
          <label className="block text-lg font-semibold text-green-900 md:text-xl">
            รหัส OTP
            <input
              name="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              minLength={4}
              maxLength={8}
              required
              autoFocus
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3.5 text-center text-xl font-bold tracking-[0.4em] outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-2xl"
              placeholder="••••••"
            />
          </label>
          {verifyState && "error" in verifyState && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-base text-red-700 md:text-lg">{verifyState.error}</p>
          )}
          <button disabled={verifying} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-6 py-3.5 text-lg font-bold text-yellow-300 transition hover:bg-green-900 disabled:opacity-60 md:py-4 md:text-xl">
            <ShieldCheck className="size-5" /> {verifying ? "กำลังยืนยัน..." : "ยืนยันและค้นหาบัตรรายปี"}
          </button>
        </form>
        <button type="button" onClick={() => setStartOver(true)} className="mt-4 w-full text-base font-semibold text-green-800 underline hover:text-green-900 md:text-lg">
          ใช้เบอร์โทรศัพท์อื่น / ส่งรหัสใหม่
        </button>
      </section>
    );
  }

  return (
    <form action={requestAction} onSubmit={() => setStartOver(false)} className="mt-7 rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
      <input type="hidden" name="target" value="season" />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-lg font-semibold text-green-900 md:text-xl">
          ชื่อผู้สมัคร <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
          <input name="customerName" minLength={2} maxLength={100} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3.5 text-lg font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-xl" placeholder="ชื่อที่ใช้สมัครบัตรรายปี" />
        </label>
        <label className="block text-lg font-semibold text-green-900 md:text-xl">
          เบอร์โทรศัพท์ <span className="font-normal text-slate-500">(บังคับ)</span>
          <input name="customerPhone" inputMode="tel" autoComplete="tel" maxLength={20} required className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3.5 text-lg font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-xl" placeholder="เบอร์ที่ใช้สมัคร" />
        </label>
      </div>
      <p className="mt-4 text-base text-slate-500 md:text-lg">ระบบจะส่งรหัส OTP ไปยังเบอร์โทรศัพท์ที่ใช้สมัคร ก่อนแสดงบัตรรายปีของคุณ</p>
      {requestState && "error" in requestState && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-lg text-red-700">{requestState.error}</p>
      )}
      <button disabled={requesting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-6 py-3.5 text-lg font-bold text-yellow-300 transition hover:bg-green-900 disabled:opacity-60 md:py-4 md:text-xl">
        <Search className="size-5" /> {requesting ? "กำลังส่งรหัส..." : "ส่งรหัส OTP"}
      </button>
    </form>
  );
}

function SeasonPassResults({ results, onStartOver }: { results: SeasonPassSearchResult[]; onStartOver: () => void }) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-green-900 md:text-2xl">ผลการค้นหา ({results.length})</h2>
        <button type="button" onClick={onStartOver} className="text-base font-semibold text-green-800 underline hover:text-green-900">ค้นหาเบอร์อื่น</button>
      </div>
      {results.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-base text-slate-600 md:text-lg">ไม่พบบัตรรายปีที่ตรงกับข้อมูลที่ระบุ</p>
      ) : (
        <div className="mt-3 space-y-3">
          {results.map((order) => (
            <div key={order.passCode} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-green-900 md:text-xl">บัตรรายปี ฿{order.priceBaht.toLocaleString("th-TH")}</p>
                  <p className="mt-1 font-mono text-sm text-slate-600">{order.passCode}</p>
                  <p className="mt-1 text-base text-slate-600 md:text-lg">สมัครเมื่อ {formatDateTime(order.createdAt)}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">{order.status}</span>
              </div>
              <a href={`/api/season-passes/${encodeURIComponent(order.passCode)}/barcode`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-800 px-5 py-2.5 text-base font-bold text-yellow-300 hover:bg-green-900 md:text-lg">
                <Ticket className="size-5" /> เปิดบาร์โค้ดบัตรรายปี
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? `${digits.slice(0, 3)}-***-${digits.slice(-4)}` : phone;
}
