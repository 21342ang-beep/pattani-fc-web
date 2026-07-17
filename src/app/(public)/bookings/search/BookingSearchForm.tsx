"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Search, Ticket } from "lucide-react";
import { findBookingsByCustomer, type BookingSearchState } from "@/app/actions/find-bookings";
import { formatBaht, formatDateTime } from "@/lib/format";

export default function BookingSearchForm() {
  const [state, formAction, pending] = useActionState<BookingSearchState, FormData>(findBookingsByCustomer, undefined);

  return (
    <>
      <form action={formAction} className="mt-6 rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-green-900">
            ชื่อผู้จอง
            <input name="customerName" minLength={2} maxLength={100} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" placeholder="ชื่อที่ใช้จอง" />
          </label>
          <label className="block text-sm font-semibold text-green-900">
            เบอร์โทรศัพท์
            <input name="customerPhone" inputMode="tel" maxLength={20} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" placeholder="เบอร์ที่ใช้จอง" />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">กรอกชื่อหรือเบอร์โทรศัพท์อย่างน้อยหนึ่งช่อง — ใส่ทั้งสองช่องเพื่อให้ผลลัพธ์แม่นยำขึ้น</p>
        {state?.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button disabled={pending} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-5 py-3 text-sm font-bold text-yellow-300 transition hover:bg-green-900 disabled:opacity-60">
          <Search className="size-4" /> {pending ? "กำลังค้นหา..." : "ค้นหารายการจอง"}
        </button>
      </form>

      {state?.results && (
        <section className="mt-6">
          <h2 className="text-xl font-black text-green-900">ผลการค้นหา ({state.results.length})</h2>
          {state.results.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">ไม่พบรายการที่ตรงกับข้อมูลที่ระบุ</p>
          ) : (
            <div className="mt-3 space-y-3">
              {state.results.map((booking) => {
                // ค้นด้วยชื่ออย่างเดียว = ไม่มีเบอร์ให้ส่งต่อ → หน้าปลายทางจะถามเบอร์เอง
                const base = booking.status === "PENDING" ? "/checkout" : "/tickets";
                const href = state.phone
                  ? `${base}/${booking.bookingCode}?phone=${encodeURIComponent(state.phone)}`
                  : `${base}/${booking.bookingCode}`;
                return (
                  <div key={booking.bookingCode} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-green-900">{booking.match.homeTeam} vs {booking.match.awayTeam}</p>
                        <p className="mt-1 text-sm text-slate-600">{booking.match.kickoffAt ? formatDateTime(booking.match.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}</p>
                        <p className="mt-2 font-mono text-xs text-slate-500">{booking.bookingCode}</p>
                      </div>
                      <p className="font-black text-green-900">{formatBaht(booking.totalAmount)}</p>
                    </div>
                    <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-yellow-300 hover:bg-green-900">
                      <Ticket className="size-4" /> {booking.status === "PENDING" ? "ไปชำระเงิน" : "เปิด E-ticket"}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
