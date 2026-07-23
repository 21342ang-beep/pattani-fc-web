"use client";

import { useActionState, useState } from "react";
import { X, Upload } from "lucide-react";
import type { MatchFormState } from "@/app/actions/matches";

type Match = {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  venue: string | null;
  kickoffAt: Date | string | null;
  totalSeats: number | null;
  zone150Seats: number | null;
  zone120Seats: number | null;
  zone100Seats: number | null;
  zoneAwaySeats: number | null;
  competitionType: string;
  status: string;
  description: string | null;
};

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
    ? new Date(initial.kickoffAt).toISOString().slice(0, 16)
    : "";
  const [zoneSeats, setZoneSeats] = useState({
    zone150Seats: initial?.zone150Seats?.toString() ?? "",
    zone120Seats: initial?.zone120Seats?.toString() ?? "",
    zone100Seats: initial?.zone100Seats?.toString() ?? "",
    zoneAwaySeats: initial?.zoneAwaySeats?.toString() ?? "",
  });
  const hasZoneSeats = Object.values(zoneSeats).some((value) => value.trim() !== "");
  const calculatedTotalSeats = hasZoneSeats
    ? Object.values(zoneSeats).reduce((sum, value) => sum + (Number(value) || 0), 0).toString()
    : initial?.totalSeats?.toString() ?? "";

  function updateZoneSeats(name: keyof typeof zoneSeats, value: string) {
    setZoneSeats((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
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
          hint="เว้นว่างได้ถ้ายังไม่กำหนด"
        />
        <Field
          label="จำนวนที่นั่ง"
          name="totalSeats"
          type="number"
          value={calculatedTotalSeats}
          readOnly
          hint="คำนวณอัตโนมัติจากจำนวนที่นั่งแยกตามราคา"
        />
      </div>
      <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">
        ราคาตั๋วกําหนดตามโซนที่ผู้ซื้อเลือก ระบบจะใช้ราคาโซนนั้นโดยอัตโนมัติ
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-bold text-slate-900">จำนวนที่นั่งเปิดขายแยกตามราคา</h2>
        <p className="mt-1 text-xs text-slate-600">เว้นว่างไว้หากยังไม่เปิดขายกลุ่มราคานั้น</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="150 บาท · โซน A, B, F" name="zone150Seats" type="number" value={zoneSeats.zone150Seats} onChange={(event) => updateZoneSeats("zone150Seats", event.target.value)} hint="จำนวนที่นั่งเปิดขายรวม" />
          <Field label="120 บาท · โซน C, E, G, J" name="zone120Seats" type="number" value={zoneSeats.zone120Seats} onChange={(event) => updateZoneSeats("zone120Seats", event.target.value)} hint="จำนวนที่นั่งเปิดขายรวม" />
          <Field label="100 บาท · โซน D, I" name="zone100Seats" type="number" value={zoneSeats.zone100Seats} onChange={(event) => updateZoneSeats("zone100Seats", event.target.value)} hint="จำนวนที่นั่งเปิดขายรวม" />
          <Field label="200 บาท · โซน AWAY" name="zoneAwaySeats" type="number" value={zoneSeats.zoneAwaySeats} onChange={(event) => updateZoneSeats("zoneAwaySeats", event.target.value)} hint="จำนวนที่นั่งเปิดขายทีมเยือน" />
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
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        {...(value === undefined ? { defaultValue } : { value })}
        onChange={onChange}
        required={required}
        readOnly={readOnly}
        className="mt-1 w-full rounded-md border px-3 py-2"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function LogoUpload({
  label,
  fileFieldName,
  existingFieldName,
  initialPath,
}: {
  label: string;
  fileFieldName: string;
  existingFieldName: string;
  initialPath: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(initialPath);
  const [removed, setRemoved] = useState(false);
  // path ที่จะ submit กลับ — null ถ้าผู้ใช้กดลบ, ไม่งั้นเป็น initialPath
  const submitExisting = removed ? "" : initialPath ?? "";

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRemoved(false);
    // preview ฝั่ง client เท่านั้น (browser-only) — ไม่ส่งไป server
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  function onRemove() {
    setPreview(null);
    setRemoved(true);
    // reset file input ถ้ามี
    const el = document.querySelector<HTMLInputElement>(
      `input[name="${fileFieldName}"]`
    );
    if (el) el.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center gap-3 rounded-md border border-dashed border-slate-300 p-2">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
          {preview ? (
            // ใช้ <img> เพราะ preview อาจเป็น blob: URL (Next/Image ไม่รองรับ)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-contain" />
          ) : (
            <Upload className="size-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <input
            type="file"
            name={fileFieldName}
            accept="image/png,image/jpeg,image/webp"
            onChange={onPick}
            className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200"
          />
          <p className="text-[11px] text-slate-500">PNG, JPG, WEBP ≤ 2MB</p>
        </div>
        {preview && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
            aria-label="ลบโล้โก้"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <input type="hidden" name={existingFieldName} value={submitExisting} />
      {removed && <input type="hidden" name={`${fileFieldName}__remove`} value="1" />}
    </div>
  );
}
