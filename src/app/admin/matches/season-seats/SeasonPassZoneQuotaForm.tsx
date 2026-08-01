"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateSeasonPassZoneQuotas,
  type SeasonPassZoneQuotaState,
} from "@/app/actions/season-pass-zone-quotas";

type ZoneRow = {
  seatZone: string;
  totalSeats: number | null;
  sponsorReserved: number | null;
  sold: number;
};

export default function SeasonPassZoneQuotaForm({
  tierId,
  badge,
  priceBaht,
  targetTotal,
  targetSponsor,
  zones,
}: {
  tierId: string;
  badge: string;
  priceBaht: number;
  targetTotal: number;
  targetSponsor: number;
  zones: ZoneRow[];
}) {
  const [state, action, pending] = useActionState<SeasonPassZoneQuotaState, FormData>(
    updateSeasonPassZoneQuotas,
    undefined,
  );
  const [values, setValues] = useState(() => Object.fromEntries(zones.map((zone) => [zone.seatZone, {
    totalSeats: zone.totalSeats?.toString() ?? "",
    sponsorReserved: zone.sponsorReserved?.toString() ?? "0",
  }])));
  const summary = useMemo(() => Object.values(values).reduce(
    (sum, row) => ({
      total: sum.total + (Number(row.totalSeats) || 0),
      sponsor: sum.sponsor + (Number(row.sponsorReserved) || 0),
    }),
    { total: 0, sponsor: 0 },
  ), [values]);

  return (
    <form action={action} className="rounded-xl border bg-white p-5 shadow-sm">
      <input type="hidden" name="tierId" value={tierId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{badge}</h2>
          <p className="mt-1 text-sm text-slate-600">แพ็กเกจ {priceBaht.toLocaleString("th-TH")} บาท</p>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
          เป้าหมายรวม {targetTotal.toLocaleString("th-TH")} · สปอนเซอร์ {targetSponsor.toLocaleString("th-TH")}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {zones.map((zone) => {
          const value = values[zone.seatZone];
          const publicSeats = Math.max(0, (Number(value.totalSeats) || 0) - (Number(value.sponsorReserved) || 0));
          return (
            <fieldset key={zone.seatZone} className="rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-base font-bold text-slate-800">โซน {zone.seatZone}</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">
                  ที่นั่งรวม
                  <input
                    type="number"
                    min={0}
                    name={`total:${zone.seatZone}`}
                    value={value.totalSeats}
                    onChange={(event) => setValues((current) => ({ ...current, [zone.seatZone]: { ...current[zone.seatZone], totalSeats: event.target.value } }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  กันสปอนเซอร์ <span className="font-normal text-slate-500">(ถ้าไม่มีใส่ 0)</span>
                  <input
                    type="number"
                    min={0}
                    name={`sponsor:${zone.seatZone}`}
                    value={value.sponsorReserved}
                    onChange={(event) => setValues((current) => ({ ...current, [zone.seatZone]: { ...current[zone.seatZone], sponsorReserved: event.target.value } }))}
                    onBlur={(event) => {
                      if (event.target.value === "") {
                        setValues((current) => ({ ...current, [zone.seatZone]: { ...current[zone.seatZone], sponsorReserved: "0" } }));
                      }
                    }}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p className="rounded bg-emerald-50 px-2 py-1.5 font-semibold text-emerald-700">เปิดขาย {publicSeats.toLocaleString("th-TH")}</p>
                <p className="rounded bg-blue-50 px-2 py-1.5 font-semibold text-blue-700">จองแล้ว {zone.sold.toLocaleString("th-TH")}</p>
              </div>
              <p className="mt-2 text-sm text-slate-600">คงเหลือ {Math.max(0, publicSeats - zone.sold).toLocaleString("th-TH")} ที่</p>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className={`text-sm font-semibold ${summary.total === targetTotal && summary.sponsor === targetSponsor ? "text-emerald-700" : "text-amber-700"}`}>
          จัดสรรรวม {summary.total.toLocaleString("th-TH")} / {targetTotal.toLocaleString("th-TH")} · สปอนเซอร์ {summary.sponsor.toLocaleString("th-TH")} / {targetSponsor.toLocaleString("th-TH")}
        </p>
        <button disabled={pending} className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? "กำลังบันทึก..." : "บันทึกแพ็กเกจนี้"}
        </button>
      </div>
      {state?.error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.error}</p>}
      {state?.success && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{state.success}</p>}
    </form>
  );
}
