"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BadgeCheck, Search, ShieldCheck, Ticket } from "lucide-react";
import {
  requestBookingSearchOtp,
  type BookingSearchResults,
  type RequestBookingSearchOtpState,
  verifyBookingSearchOtp,
  type VerifyBookingSearchOtpState,
} from "@/app/actions/booking-search-otp";
import { formatBaht, formatDateTime } from "@/lib/format";

export default function BookingSearchForm() {
  const [formKey, setFormKey] = useState(0);

  return (
    <BookingSearchFlow
      key={formKey}
      onStartOver={() => setFormKey((current) => current + 1)}
    />
  );
}

function BookingSearchFlow({ onStartOver }: { onStartOver: () => void }) {
  const [requestState, requestAction, requesting] = useActionState<
    RequestBookingSearchOtpState,
    FormData
  >(requestBookingSearchOtp, undefined);
  const [verifyState, verifyAction, verifying] = useActionState<
    VerifyBookingSearchOtpState,
    FormData
  >(verifyBookingSearchOtp, undefined);

  const request = requestState && "requested" in requestState
    ? requestState
    : null;
  const results = verifyState && "results" in verifyState
    ? verifyState.results
    : null;

  if (results) {
    return <BookingResults results={results} onStartOver={onStartOver} />;
  }

  if (request) {
    return (
      <section className="rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
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
            <ShieldCheck className="size-5" /> {verifying ? "กำลังยืนยัน..." : "ยืนยันและแสดงการจองทั้งหมด"}
          </button>
        </form>
        <button type="button" onClick={onStartOver} className="mt-4 w-full text-base font-semibold text-green-800 underline hover:text-green-900 md:text-lg">
          ใช้เบอร์โทรศัพท์อื่น / ส่งรหัสใหม่
        </button>
      </section>
    );
  }

  return (
    <form action={requestAction} className="rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
      <label className="block text-lg font-semibold text-green-900 md:text-xl">
        เบอร์โทรศัพท์ที่ใช้จอง
        <input name="customerPhone" inputMode="tel" autoComplete="tel" maxLength={20} required className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3.5 text-lg font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-xl" placeholder="เช่น 0929810552" />
      </label>
      <p className="mt-4 text-base text-slate-500 md:text-lg">ระบบจะส่ง OTP หนึ่งครั้ง แล้วแสดงทั้งตั๋วรายแมตช์และบัตรรายปีทั้งหมดที่จองด้วยเบอร์นี้</p>
      {requestState && "error" in requestState && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-lg text-red-700">{requestState.error}</p>
      )}
      <button disabled={requesting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-6 py-3.5 text-lg font-bold text-yellow-300 transition hover:bg-green-900 disabled:opacity-60 md:py-4 md:text-xl">
        <Search className="size-5" /> {requesting ? "กำลังส่งรหัส..." : "ส่งรหัส OTP"}
      </button>
    </form>
  );
}

function BookingResults({
  results,
  onStartOver,
}: {
  results: BookingSearchResults;
  onStartOver: () => void;
}) {
  const matchTicketCount = results.bookings.reduce((sum, booking) => sum + booking.quantity, 0);
  const seasonPassCount = results.seasonPasses.length;
  const totalTicketCount = matchTicketCount + seasonPassCount;

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-green-900 md:text-2xl">พบทั้งหมด {totalTicketCount} ใบ</h2>
          <p className="mt-1 text-base text-slate-600 md:text-lg">
            ตั๋วรายแมตช์ {matchTicketCount} ใบ · บัตรรายปี {seasonPassCount} ใบ
          </p>
        </div>
        <button type="button" onClick={onStartOver} className="text-base font-semibold text-green-800 underline hover:text-green-900">ค้นหาเบอร์อื่น</button>
      </div>

      {totalTicketCount === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-base text-slate-600 md:text-lg">ไม่พบรายการจองด้วยเบอร์โทรศัพท์นี้</p>
      ) : (
        <div className="mt-6 space-y-8">
          <ResultSection title="ตั๋วรายแมตช์" count={matchTicketCount} icon={<Ticket className="size-5" />}>
            {results.bookings.length === 0 ? (
              <EmptyResult text="ไม่พบตั๋วรายแมตช์" />
            ) : (
              results.bookings.map((booking) => {
                const base = booking.status === "PENDING" ? "/checkout" : "/tickets";
                return (
                  <article key={booking.bookingCode} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-green-900 md:text-xl">{booking.match.homeTeam} vs {booking.match.awayTeam}</p>
                        <p className="mt-1 text-base text-slate-600 md:text-lg">{booking.match.kickoffAt ? formatDateTime(booking.match.kickoffAt) : "ยังไม่ระบุวันแข่งขัน"}</p>
                        <p className="mt-1 text-base font-semibold text-green-800">จำนวน {booking.quantity} ใบ</p>
                        <p className="mt-2 font-mono text-sm text-slate-500">{booking.bookingCode}</p>
                      </div>
                      <p className="text-xl font-black text-green-900 md:text-2xl">{formatBaht(booking.totalAmount)}</p>
                    </div>
                    <Link href={`${base}/${booking.bookingCode}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-800 px-5 py-2.5 text-base font-bold text-yellow-300 hover:bg-green-900 md:text-lg">
                      <Ticket className="size-5" /> {booking.status === "PENDING" ? "ไปชำระเงิน" : "เปิด E-ticket"}
                    </Link>
                  </article>
                );
              })
            )}
          </ResultSection>

          <ResultSection title="บัตรรายปี" count={seasonPassCount} icon={<BadgeCheck className="size-5" />}>
            {results.seasonPasses.length === 0 ? (
              <EmptyResult text="ไม่พบบัตรรายปี" />
            ) : (
              results.seasonPasses.map((order) => (
                <article key={order.passCode} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
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
                </article>
              ))
            )}
          </ResultSection>
        </div>
      )}
    </section>
  );
}

function ResultSection({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-lg font-black text-green-900 md:text-xl">
        {icon} {title}
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-900">{count} ใบ</span>
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function EmptyResult({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-base text-slate-600">{text}</p>;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? `${digits.slice(0, 3)}-***-${digits.slice(-4)}` : phone;
}
