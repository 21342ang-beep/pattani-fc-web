"use client";

import { useActionState, useState } from "react";
import type { MatchTicketZoneFormState } from "@/app/actions/match-ticket-zones";

type ZoneRow = {
  key: string;
  code: string;
  name: string;
  capacity: string;
  priceBaht: string;
  isActive: boolean;
  booked: number;
};

export default function MatchTicketZonesForm({
  action,
  initialZones,
}: {
  action: (previous: MatchTicketZoneFormState, formData: FormData) => Promise<MatchTicketZoneFormState>;
  initialZones: Array<{
    id: string;
    code: string;
    name: string;
    capacity: number;
    price: number;
    isActive: boolean;
    booked: number;
  }>;
}) {
  const [state, formAction, pending] = useActionState<MatchTicketZoneFormState, FormData>(action, undefined);
  const [nextKey, setNextKey] = useState(1);
  const [zones, setZones] = useState<ZoneRow[]>(() => initialZones.map((zone) => ({
    key: zone.id,
    code: zone.code,
    name: zone.name,
    capacity: String(zone.capacity),
    priceBaht: String(zone.price / 100),
    isActive: zone.isActive,
    booked: zone.booked,
  })));

  const serialized = JSON.stringify(zones.map((zone) => ({
    code: zone.code.trim().toUpperCase(),
    name: zone.name.trim(),
    capacity: Number(zone.capacity),
    priceBaht: Number(zone.priceBaht),
    isActive: zone.isActive,
  })));

  function updateZone(key: string, patch: Partial<ZoneRow>) {
    setZones((current) => current.map((zone) => zone.key === key ? { ...zone, ...patch } : zone));
  }

  function addZone() {
    const key = `new-${nextKey}`;
    setNextKey((value) => value + 1);
    setZones((current) => [...current, {
      key,
      code: "",
      name: "",
      capacity: "",
      priceBaht: "",
      isActive: true,
      booked: 0,
    }]);
  }

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-lg border border-violet-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="zones" value={serialized} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-violet-950 md:text-2xl">โซนขายเพิ่มเติมรายแมตช์</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 md:text-base">
            ใช้สำหรับ VVIP, VIP หรือโซนพิเศษของสนามอื่น โดยเพิ่มชื่อได้เอง ไม่ผูกกับโค้ดระบบ
          </p>
        </div>
        <button type="button" onClick={addZone} className="rounded-lg bg-violet-700 px-4 py-2.5 font-bold text-white hover:bg-violet-600">
          + เพิ่มโซน
        </button>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 md:text-base">
        จำนวนที่กรอกคือ “ที่นั่งที่เหลือและอนุญาตให้ขายรายแมตช์” หลังหักที่นั่งสมาชิกบัตรรายปี/สปอนเซอร์แล้ว เพื่อป้องกันขายเกินจริง
      </p>

      <div className="space-y-3">
        {zones.map((zone, index) => (
          <fieldset key={zone.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <legend className="px-1 text-sm font-bold text-slate-600">โซนเพิ่มเติม #{index + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[0.8fr_1.5fr_1fr_1fr_auto] lg:items-end">
              <ZoneField label="รหัสโซน" hint="เช่น VVIP-A" value={zone.code} onChange={(value) => updateZone(zone.key, { code: value.toUpperCase() })} />
              <ZoneField label="ชื่อที่แสดง" hint="เช่น VVIP ฝั่งประธาน" value={zone.name} onChange={(value) => updateZone(zone.key, { name: value })} />
              <ZoneField label="จำนวนเปิดขาย" type="number" min="0" value={zone.capacity} onChange={(value) => updateZone(zone.key, { capacity: value })} />
              <ZoneField label="ราคา/ใบ (บาท)" type="number" min="0.01" step="0.01" value={zone.priceBaht} onChange={(value) => updateZone(zone.key, { priceBaht: value })} />
              <button
                type="button"
                onClick={() => setZones((current) => current.filter((item) => item.key !== zone.key))}
                className="rounded-lg border border-red-200 bg-white px-3 py-2.5 font-semibold text-red-700 hover:bg-red-50"
              >
                ลบ
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 md:text-base">
                <input type="checkbox" checked={zone.isActive} onChange={(event) => updateZone(zone.key, { isActive: event.target.checked })} className="size-4" />
                เปิดให้ลูกค้าเห็นและจองได้
              </label>
              {zone.booked > 0 && <span className="text-sm font-bold text-emerald-700">จองอยู่ {zone.booked.toLocaleString("th-TH")} ที่</span>}
            </div>
          </fieldset>
        ))}
        {zones.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            ยังไม่มีโซนเพิ่มเติม กด “เพิ่มโซน” เพื่อกำหนด VVIP, VIP หรือชื่ออื่นตามสนามจริง
          </div>
        )}
      </div>

      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-3 font-medium text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-4 py-3 font-medium text-emerald-800">บันทึกโซนขายเพิ่มเติมแล้ว</p>}

      <button type="submit" disabled={pending} className="rounded-lg bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-700 disabled:bg-slate-400">
        {pending ? "กำลังบันทึก..." : "บันทึกโซนเพิ่มเติม"}
      </button>
    </form>
  );
}

function ZoneField({
  label,
  hint,
  type = "text",
  min,
  step,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  type?: string;
  min?: string;
  step?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700 md:text-base">
      {label}
      <input type={type} min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5 font-normal" />
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  );
}
