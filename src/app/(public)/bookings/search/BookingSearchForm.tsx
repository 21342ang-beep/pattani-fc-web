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
import type { Locale } from "@/lib/i18n/dict";
import { intlLocale, localize } from "@/lib/i18n/text";

export default function BookingSearchForm({ locale }: { locale: Locale }) {
  const [formKey, setFormKey] = useState(0);

  return (
    <BookingSearchFlow
      key={formKey}
      locale={locale}
      onStartOver={() => setFormKey((current) => current + 1)}
    />
  );
}

function BookingSearchFlow({ onStartOver, locale }: { onStartOver: () => void; locale: Locale }) {
  const t = (th: string, en: string) => localize(locale, th, en);
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
    return <BookingResults results={results} onStartOver={onStartOver} locale={locale} />;
  }

  if (request) {
    return (
      <section className="rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
        <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4 text-green-900">
          <ShieldCheck className="mt-0.5 size-6 shrink-0" />
          <div>
            <h2 className="text-xl font-black md:text-2xl">{t("ยืนยันรหัส OTP", "Verify OTP")}</h2>
            <p className="mt-1 text-base text-green-800 md:text-lg">
              {t("ส่งรหัสไปยัง", "A code was sent to")} {maskPhone(request.phone)}
              {request.reference ? ` · Ref: ${request.reference}` : ""}
            </p>
          </div>
        </div>

        <form action={verifyAction} className="mt-6 space-y-5">
          <label className="block text-lg font-semibold text-green-900 md:text-xl">
            {t("รหัส OTP", "OTP Code")}
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
            <ShieldCheck className="size-5" /> {verifying ? t("กำลังยืนยัน...", "Verifying...") : t("ยืนยันและแสดงการจองทั้งหมด", "Verify and Show All Bookings")}
          </button>
        </form>
        <button type="button" onClick={onStartOver} className="mt-4 w-full text-base font-semibold text-green-800 underline hover:text-green-900 md:text-lg">
          {t("ใช้เบอร์โทรศัพท์อื่น / ส่งรหัสใหม่", "Use Another Phone Number / Resend Code")}
        </button>
      </section>
    );
  }

  return (
    <form action={requestAction} className="rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
      <label className="block text-lg font-semibold text-green-900 md:text-xl">
        {t("เบอร์โทรศัพท์ที่ใช้จอง", "Booking Phone Number")}
        <input name="customerPhone" inputMode="tel" autoComplete="tel" maxLength={20} required className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3.5 text-lg font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-xl" placeholder={t("เช่น 0929810552", "e.g. 0929810552")} />
      </label>
      <p className="mt-4 text-base text-slate-500 md:text-lg">{t("ระบบจะส่ง OTP หนึ่งครั้ง แล้วแสดงทั้งตั๋วรายแมตช์และบัตรรายปีทั้งหมดที่จองด้วยเบอร์นี้", "We will send one OTP, then show every match ticket and season pass booked with this number.")}</p>
      {requestState && "error" in requestState && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-lg text-red-700">{requestState.error}</p>
      )}
      <button disabled={requesting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-6 py-3.5 text-lg font-bold text-yellow-300 transition hover:bg-green-900 disabled:opacity-60 md:py-4 md:text-xl">
        <Search className="size-5" /> {requesting ? t("กำลังส่งรหัส...", "Sending code...") : t("ส่งรหัส OTP", "Send OTP")}
      </button>
    </form>
  );
}

function BookingResults({
  results,
  onStartOver,
  locale,
}: {
  results: BookingSearchResults;
  onStartOver: () => void;
  locale: Locale;
}) {
  const t = (th: string, en: string) => localize(locale, th, en);
  const matchTicketCount = results.bookings.reduce((sum, booking) => sum + booking.quantity, 0);
  const seasonPassCount = results.seasonPasses.length;
  const totalTicketCount = matchTicketCount + seasonPassCount;

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-green-900 md:text-2xl">{t("พบทั้งหมด", "Found")} {totalTicketCount} {t("ใบ", "tickets")}</h2>
          <p className="mt-1 text-base text-slate-600 md:text-lg">
            {t("ตั๋วรายแมตช์", "Match tickets")} {matchTicketCount} · {t("บัตรรายปี", "Season passes")} {seasonPassCount}
          </p>
        </div>
        <button type="button" onClick={onStartOver} className="text-base font-semibold text-green-800 underline hover:text-green-900">{t("ค้นหาเบอร์อื่น", "Search Another Number")}</button>
      </div>

      {totalTicketCount === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-base text-slate-600 md:text-lg">{t("ไม่พบรายการจองด้วยเบอร์โทรศัพท์นี้", "No bookings were found for this phone number")}</p>
      ) : (
        <div className="mt-6 space-y-8">
          <ResultSection title={t("ตั๋วรายแมตช์", "Match Tickets")} count={matchTicketCount} icon={<Ticket className="size-5" />} unit={t("ใบ", "tickets")}>
            {results.bookings.length === 0 ? (
              <EmptyResult text={t("ไม่พบตั๋วรายแมตช์", "No match tickets found")} />
            ) : (
              results.bookings.map((booking) => {
                const base = booking.status === "PENDING" ? "/checkout" : "/tickets";
                return (
                  <article key={booking.bookingCode} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-green-900 md:text-xl">{booking.match.homeTeam} vs {booking.match.awayTeam}</p>
                        <p className="mt-1 text-base text-slate-600 md:text-lg">{booking.match.kickoffAt ? formatDateTime(booking.match.kickoffAt, intlLocale(locale)) : t("ยังไม่ระบุวันแข่งขัน", "Match date not specified")}</p>
                        <p className="mt-1 text-base font-semibold text-green-800">{t("จำนวน", "Quantity")} {booking.quantity}</p>
                        <p className="mt-2 font-mono text-sm text-slate-500">{booking.bookingCode}</p>
                      </div>
                      <p className="text-xl font-black text-green-900 md:text-2xl">{formatBaht(booking.totalAmount, intlLocale(locale))}</p>
                    </div>
                    <Link href={`${base}/${booking.bookingCode}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-800 px-5 py-2.5 text-base font-bold text-yellow-300 hover:bg-green-900 md:text-lg">
                      <Ticket className="size-5" /> {booking.status === "PENDING" ? t("ไปชำระเงิน", "Proceed to Payment") : t("เปิด E-ticket", "Open E-ticket")}
                    </Link>
                  </article>
                );
              })
            )}
          </ResultSection>

          <ResultSection title={t("บัตรรายปี", "Season Passes")} count={seasonPassCount} icon={<BadgeCheck className="size-5" />} unit={t("ใบ", "passes")}>
            {results.seasonPasses.length === 0 ? (
              <EmptyResult text={t("ไม่พบบัตรรายปี", "No season passes found")} />
            ) : (
              results.seasonPasses.map((order) => (
                <article key={order.passCode} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-green-900 md:text-xl">{t("บัตรรายปี", "Season Pass")} ฿{order.priceBaht.toLocaleString(intlLocale(locale))}</p>
                      <p className="mt-1 font-mono text-sm text-slate-600">{order.passCode}</p>
                      <p className="mt-1 text-base text-slate-600 md:text-lg">{t("สมัครเมื่อ", "Purchased on")} {formatDateTime(order.createdAt, intlLocale(locale))}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">{order.status}</span>
                  </div>
                  <a href={`/api/season-passes/${encodeURIComponent(order.passCode)}/barcode`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-800 px-5 py-2.5 text-base font-bold text-yellow-300 hover:bg-green-900 md:text-lg">
                    <Ticket className="size-5" /> {t("เปิดบาร์โค้ดบัตรรายปี", "Open Season Pass Barcode")}
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
  unit,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  unit: string;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-lg font-black text-green-900 md:text-xl">
        {icon} {title}
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-900">{count} {unit}</span>
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
