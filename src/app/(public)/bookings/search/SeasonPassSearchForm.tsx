"use client";

import { useActionState } from "react";
import { Search, Ticket } from "lucide-react";
import {
  findSeasonPassesByCustomer,
  type SeasonPassSearchState,
} from "@/app/actions/find-bookings";
import { formatDateTime } from "@/lib/format";

export default function SeasonPassSearchForm() {
  const [state, formAction, pending] = useActionState<SeasonPassSearchState, FormData>(
    findSeasonPassesByCustomer,
    undefined,
  );

  return (
    <>
      <form action={formAction} className="mt-7 rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-lg font-semibold text-green-900 md:text-xl">
            ชื่อผู้สมัคร
            <input name="customerName" minLength={2} maxLength={100} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3.5 text-lg font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-xl" placeholder="ชื่อที่ใช้สมัครบัตรรายปี" />
          </label>
          <label className="block text-lg font-semibold text-green-900 md:text-xl">
            เบอร์โทรศัพท์
            <input name="customerPhone" inputMode="tel" maxLength={20} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3.5 text-lg font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-xl" placeholder="เบอร์ที่ใช้สมัคร" />
          </label>
        </div>
        <p className="mt-4 text-base text-slate-500 md:text-lg">กรอกชื่อหรือเบอร์โทรศัพท์อย่างน้อยหนึ่งช่อง</p>
        {state?.error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-lg text-red-700">{state.error}</p>}
        <button disabled={pending} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-6 py-3.5 text-lg font-bold text-yellow-300 transition hover:bg-green-900 disabled:opacity-60 md:py-4 md:text-xl">
          <Search className="size-5" /> {pending ? "กำลังค้นหา..." : "ค้นหาบัตรรายปี"}
        </button>
      </form>

      {state?.results && (
        <section className="mt-6">
          <h2 className="text-xl font-black text-green-900">ผลการค้นหา ({state.results.length})</h2>
          {state.results.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">ไม่พบรายการที่ตรงกับข้อมูลที่ระบุ</p>
          ) : (
            <div className="mt-3 space-y-3">
              {state.results.map((order) => (
                <div key={order.passCode} className="rounded-xl border border-green-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-green-900">บัตรรายปี ฿{order.priceBaht.toLocaleString("th-TH")}</p>
                      <p className="mt-1 font-mono text-xs text-slate-600">{order.passCode}</p>
                      <p className="mt-1 text-sm text-slate-600">สมัครเมื่อ {formatDateTime(order.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{order.status}</span>
                  </div>
                  <a href={`/api/season-passes/${encodeURIComponent(order.passCode)}/barcode`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-yellow-300 hover:bg-green-900">
                    <Ticket className="size-4" /> เปิดบาร์โค้ดบัตรรายปี
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
