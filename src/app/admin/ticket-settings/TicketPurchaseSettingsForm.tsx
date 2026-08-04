"use client";

import { useActionState } from "react";
import {
  updateTicketPurchaseSettings,
  type TicketPurchaseSettingsState,
} from "@/app/actions/ticket-purchase-settings";

export default function TicketPurchaseSettingsForm({
  matchMaxQuantity,
  seasonPassMaxQuantity,
}: {
  matchMaxQuantity: number;
  seasonPassMaxQuantity: number;
}) {
  const [state, action, pending] = useActionState<
    TicketPurchaseSettingsState,
    FormData
  >(updateTicketPurchaseSettings, undefined);

  return (
    <form action={action} className="mt-6 max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {state && (
        <p className={`rounded-lg px-4 py-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      <QuantityField
        name="matchMaxQuantity"
        label="ตั๋วรายแมตช์"
        description="จำนวนตั๋วสูงสุดที่ลูกค้าซื้อได้ต่อหนึ่งรายการจอง"
        defaultValue={matchMaxQuantity}
        error={!state?.ok ? state?.fieldErrors?.matchMaxQuantity?.[0] : undefined}
      />
      <QuantityField
        name="seasonPassMaxQuantity"
        label="บัตรรายปี"
        description="จำนวนบัตรรายปีสูงสุดที่ลูกค้าซื้อและชำระพร้อมกันได้"
        defaultValue={seasonPassMaxQuantity}
        error={!state?.ok ? state?.fieldErrors?.seasonPassMaxQuantity?.[0] : undefined}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-green-800 px-5 py-3 font-bold text-yellow-300 hover:bg-green-900 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
      </button>
    </form>
  );
}

function QuantityField({
  name,
  label,
  description,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  description: string;
  defaultValue: number;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-lg font-bold text-slate-900">{label}</span>
      <span className="mt-1 block text-sm text-slate-600">{description}</span>
      <input
        name={name}
        type="number"
        min={1}
        max={100}
        defaultValue={defaultValue}
        required
        className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 text-lg outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}
