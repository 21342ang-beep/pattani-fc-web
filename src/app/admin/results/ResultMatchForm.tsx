"use client";

import { useActionState } from "react";
import type { ResultMatchFormState } from "@/app/actions/match-results";
import LogoUpload from "@/app/admin/matches/LogoUpload";

type Initial = {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  kickoffAt: Date | string | null;
  homeScore: number | null;
  awayScore: number | null;
};

function toLocalInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ResultMatchForm({
  action,
  competitionType,
  initial,
  submitLabel,
}: {
  action: (prev: ResultMatchFormState, fd: FormData) => Promise<ResultMatchFormState>;
  competitionType: "LEAGUE" | "CUP";
  initial?: Initial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ResultMatchFormState, FormData>(
    action,
    undefined
  );
  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <input type="hidden" name="competitionType" value={competitionType} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label htmlFor="homeTeam" className="block text-sm font-medium">ทีมเหย้า *</label>
            <input
              id="homeTeam"
              name="homeTeam"
              required
              maxLength={100}
              defaultValue={initial?.homeTeam}
              placeholder="เช่น ปัตตานี เอฟซี"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <LogoUpload
            label="โล้โก้ทีมเหย้า"
            fileFieldName="homeTeamLogoFile"
            existingFieldName="homeTeamLogoExisting"
            initialPath={initial?.homeTeamLogo ?? null}
          />
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="awayTeam" className="block text-sm font-medium">ทีมเยือน *</label>
            <input
              id="awayTeam"
              name="awayTeam"
              required
              maxLength={100}
              defaultValue={initial?.awayTeam}
              placeholder="เช่น การท่าเรือ เอฟซี"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <LogoUpload
            label="โล้โก้ทีมเยือน"
            fileFieldName="awayTeamLogoFile"
            existingFieldName="awayTeamLogoExisting"
            initialPath={initial?.awayTeamLogo ?? null}
          />
        </div>
      </div>
      <div>
        <label htmlFor="kickoffAt" className="block text-sm font-medium">วันเวลาแข่ง</label>
        <input
          id="kickoffAt"
          name="kickoffAt"
          type="datetime-local"
          defaultValue={toLocalInputValue(initial?.kickoffAt)}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <p className="mt-1 text-xs text-slate-500">เว้นว่างได้ถ้ายังไม่กำหนด</p>
      </div>
      {initial && (
        <div>
          <label className="block text-sm font-medium">สกอร์ (แก้ไขเมื่อบันทึกผลผิด)</label>
          <div className="mt-1 flex items-center gap-2">
            <label className="sr-only" htmlFor="homeScore">สกอร์ทีมเหย้า</label>
            <input
              id="homeScore"
              name="homeScore"
              type="number"
              min="0"
              max="99"
              defaultValue={initial.homeScore ?? ""}
              className="w-20 rounded-md border px-2 py-2 text-center font-bold"
            />
            <span className="font-bold text-slate-400">-</span>
            <label className="sr-only" htmlFor="awayScore">สกอร์ทีมเยือน</label>
            <input
              id="awayScore"
              name="awayScore"
              type="number"
              min="0"
              max="99"
              defaultValue={initial.awayScore ?? ""}
              className="w-20 rounded-md border px-2 py-2 text-center font-bold"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            เว้นว่างทั้งสองช่องเพื่อยกเลิกผลที่บันทึกไว้ — แมตช์จะกลับเป็นยังไม่จบการแข่งขัน
          </p>
        </div>
      )}
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-slate-400"
      >
        {pending ? "กำลังบันทึก..." : submitLabel}
      </button>
    </form>
  );
}
