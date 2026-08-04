"use client";

import { useActionState, useState } from "react";
import type { MatchFormState } from "@/app/actions/matches";
import {
  STADIUM_ZONE_CODES,
  STADIUM_ZONES,
  MATCH_ZONE_CAPACITY_FIELDS,
  MATCH_ZONE_PRICE_FIELDS,
} from "@/lib/stadium-zones";
import LogoUpload from "./LogoUpload";

type Match = {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  venue: string | null;
  kickoffAt: Date | string | null;
  totalSeats: number | null;
  zoneASeats: number | null;
  zoneBSeats: number | null;
  zoneCSeats: number | null;
  zoneDSeats: number | null;
  zoneESeats: number | null;
  zoneFSeats: number | null;
  zoneGSeats: number | null;
  zoneISeats: number | null;
  zoneJSeats: number | null;
  zone170Seats: number | null;
  zone150Seats: number | null;
  zone120Seats: number | null;
  zone100Seats: number | null;
  zoneAwaySeats: number | null;
  zoneAPrice: number | null;
  zoneBPrice: number | null;
  zoneCPrice: number | null;
  zoneDPrice: number | null;
  zoneEPrice: number | null;
  zoneFPrice: number | null;
  zoneGPrice: number | null;
  zoneIPrice: number | null;
  zoneJPrice: number | null;
  zoneAwayPrice: number | null;
  competitionType: string;
  status: string;
  description: string | null;
};

function toBangkokDateTimeInput(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export default function MatchForm({
  action,
  initial,
  submitLabel,
  defaultCompetitionType,
}: {
  action: (prev: MatchFormState, fd: FormData) => Promise<MatchFormState>;
  initial?: Match;
  submitLabel: string;
  defaultCompetitionType?: "LEAGUE" | "CUP";
}) {
  const [state, formAction, pending] = useActionState<MatchFormState, FormData>(action, undefined);
  const initialKickoff = initial?.kickoffAt
    ? toBangkokDateTimeInput(initial.kickoffAt)
    : "";
  const [zoneSeats, setZoneSeats] = useState({
    zoneASeats: initial?.zoneASeats?.toString() ?? "",
    zoneBSeats: initial?.zoneBSeats?.toString() ?? "",
    zoneCSeats: initial?.zoneCSeats?.toString() ?? "",
    zoneDSeats: initial?.zoneDSeats?.toString() ?? "",
    zoneESeats: initial?.zoneESeats?.toString() ?? "",
    zoneFSeats: initial?.zoneFSeats?.toString() ?? "",
    zoneGSeats: initial?.zoneGSeats?.toString() ?? "",
    zoneISeats: initial?.zoneISeats?.toString() ?? "",
    zoneJSeats: initial?.zoneJSeats?.toString() ?? "",
    zoneAwaySeats: initial?.zoneAwaySeats?.toString() ?? "",
  });
  const hasPerZoneSeats = Object.entries(zoneSeats).some(
    ([field, value]) => field !== "zoneAwaySeats" && value.trim() !== "",
  );
  const calculatedTotalSeats = hasPerZoneSeats
    ? Object.values(zoneSeats).reduce((sum, value) => sum + (Number(value) || 0), 0).toString()
    : initial?.totalSeats?.toString() ?? "";

  function updateZoneSeats(name: keyof typeof zoneSeats, value: string) {
    setZoneSeats((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <input type="hidden" name="legacyZone170Seats" value={initial?.zone170Seats ?? ""} />
      <input type="hidden" name="legacyZone150Seats" value={initial?.zone150Seats ?? ""} />
      <input type="hidden" name="legacyZone120Seats" value={initial?.zone120Seats ?? ""} />
      <input type="hidden" name="legacyZone100Seats" value={initial?.zone100Seats ?? ""} />
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="font-semibold">💡 บันทึกแบบฉบับร่างได้</p>
        <p className="mt-0.5">
          เฉพาะ <strong>ทีมเหย้า/ทีมเยือน</strong> เท่านั้นที่จำเป็น — field อื่นเว้นว่างไว้ก่อนแล้วมาแก้ทีหลังได้
          (แต่ต้องกรอกครบก่อนเปลี่ยนสถานะเป็น &quot;เปิดจอง&quot;)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Field label="ทีมเหย้า *" name="homeTeam" defaultValue={initial?.homeTeam} required />
          <LogoUpload
            label="โล้โก้ทีมเหย้า"
            fileFieldName="homeTeamLogoFile"
            existingFieldName="homeTeamLogoExisting"
            initialPath={initial?.homeTeamLogo ?? null}
          />
        </div>
        <div className="space-y-3">
          <Field label="ทีมเยือน *" name="awayTeam" defaultValue={initial?.awayTeam} required />
          <LogoUpload
            label="โล้โก้ทีมเยือน"
            fileFieldName="awayTeamLogoFile"
            existingFieldName="awayTeamLogoExisting"
            initialPath={initial?.awayTeamLogo ?? null}
          />
        </div>
      </div>

      <Field
        label="สนาม"
        name="venue"
        defaultValue={initial?.venue ?? ""}
        hint="เว้นว่างได้ถ้ายังไม่ทราบ"
      />
      <div>
        <label className="block text-sm font-medium">ประเภทการแข่งขัน</label>
        <select
          name="competitionType"
          defaultValue={initial?.competitionType ?? defaultCompetitionType ?? "LEAGUE"}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="LEAGUE">บอลลีก</option>
          <option value="CUP">บอลถ้วย</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="วันเวลาแข่ง"
          name="kickoffAt"
          type="datetime-local"
          defaultValue={initialKickoff}
          hint="ใช้เวลาไทย (ICT) · เว้นว่างได้ถ้ายังไม่กำหนด"
        />
        <Field
          label="จำนวนที่นั่ง"
          name="totalSeats"
          type="number"
          value={calculatedTotalSeats}
          readOnly
          hint="คำนวณอัตโนมัติจากจำนวนที่นั่งแยกทุกโซน"
        />
      </div>
      <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">
        กำหนดราคาแยกตามโซนสำหรับแมตช์นี้ ระบบจะแสดงราคาและคำนวณยอดชำระจากค่าที่บันทึกไว้ที่นี่
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-bold text-slate-900 md:text-xl">จำนวนที่นั่งและราคาแยกแต่ละโซน</h2>
        <p className="mt-1 text-base text-slate-600 md:text-lg">กรอกความจุจริงและราคาต่อใบ (บาท) · หากไม่เปิดขายให้ใส่จำนวนที่นั่งเป็น 0</p>
        {!hasPerZoneSeats && initial?.zone150Seats != null && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900 md:text-lg">
            แมตช์นี้ยังใช้จำนวนรวมแบบเดิมตามกลุ่มราคา กรุณากรอกทุกโซนก่อนบันทึกเพื่อเปลี่ยนเป็นระบบรายโซน
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STADIUM_ZONE_CODES.map((code) => {
            const field = MATCH_ZONE_CAPACITY_FIELDS[code];
            const priceField = MATCH_ZONE_PRICE_FIELDS[code];
            return (
              <div key={code} className="rounded-md border bg-white p-3">
                <p className="mb-3 text-base font-bold text-slate-900 md:text-lg">โซน {code}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="จำนวนที่นั่ง"
                    name={field}
                    type="number"
                    min={0}
                    value={zoneSeats[field]}
                    onChange={(event) => updateZoneSeats(field, event.target.value)}
                  />
                  <Field
                    label="ราคา/ใบ (บาท)"
                    name={priceField}
                    type="number"
                    min={0.01}
                    step="0.01"
                    defaultValue={initial?.[priceField] != null ? (initial[priceField] / 100).toString() : ""}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-500 md:text-base">{STADIUM_ZONES[code].label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">สถานะ</label>
        <select
          name="status"
          defaultValue={initial?.status ?? "SCHEDULED"}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="SCHEDULED">ยังไม่เปิดจอง</option>
          <option value="ON_SALE">เปิดจอง</option>
          <option value="SOLD_OUT">เต็ม</option>
          <option value="CANCELLED">ยกเลิก</option>
          <option value="FINISHED">จบแล้ว</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">รายละเอียด</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ""}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.fieldErrors && (
        <ul className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>
              <strong>{k}:</strong> {v?.[0]}
            </li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
      >
        {pending ? "กำลังบันทึก..." : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  value,
  onChange,
  required,
  hint,
  readOnly,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  hint?: string;
  readOnly?: boolean;
  min?: number;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-base font-medium md:text-lg">{label}</label>
      <input
        name={name}
        type={type}
        {...(value === undefined ? { defaultValue } : { value })}
        onChange={onChange}
        required={required}
        readOnly={readOnly}
        min={min}
        step={step}
        className="mt-1 w-full rounded-md border px-3 py-2.5 text-base md:text-lg"
      />
      {hint && <p className="mt-1 text-sm text-slate-500 md:text-base">{hint}</p>}
    </div>
  );
}
