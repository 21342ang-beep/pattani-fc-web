"use client";

import { useActionState } from "react";
import {
  grantShopOrderAccess,
  type ShopOrderAccessState,
} from "@/app/actions/shop-order-access";

export default function PhoneGate({ code }: { code: string }) {
  const [state, action, pending] = useActionState<
    ShopOrderAccessState,
    FormData
  >(grantShopOrderAccess, undefined);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-green-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black text-green-900">ยืนยันตัวตน</h1>
        <p className="mt-2 text-sm text-slate-600">
          กรอกเบอร์โทรที่ใช้ตอนสั่งซื้อเพื่อดูรายละเอียดออเดอร์
        </p>
        <form
          className="mt-5 space-y-3"
          action={action}
        >
          <input type="hidden" name="code" value={code} />
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="เช่น 081-234-5678"
            className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-green-800 px-5 py-3 text-base font-semibold text-yellow-300 transition hover:bg-green-900"
          >
            {pending ? "กำลังตรวจสอบ..." : "ดูออเดอร์"}
          </button>
          {state?.error && (
            <p className="text-sm font-semibold text-red-700">{state.error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
