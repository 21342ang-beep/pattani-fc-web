"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { updateLeagueTeam, type LeagueTeamFormState } from "@/app/actions/league-teams";

type Team = { id: string; name: string; logo: string | null; sortOrder: number };

export default function LeagueTeamManager({ teams }: { teams: Team[] }) {
  return <div className="space-y-3">{teams.map((team) => <TeamEditor key={team.id} team={team} />)}</div>;
}

function TeamEditor({ team }: { team: Team }) {
  const [state, action, pending] = useActionState<LeagueTeamFormState, FormData>(updateLeagueTeam, undefined);
  const [preview, setPreview] = useState<string | null>(team.logo);
  const [removeLogo, setRemoveLogo] = useState(false);
  return (
    <form action={action} className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[5rem_5rem_minmax(0,1fr)_auto] sm:items-center">
      <input type="hidden" name="id" value={team.id} />
      <div><label className="text-xs text-slate-500">ลำดับ</label><input name="sortOrder" type="number" min="1" defaultValue={team.sortOrder} className="mt-1 w-full rounded-md border px-2 py-2 text-center" /></div>
      <div className="flex justify-center"><label className="cursor-pointer"><span className="flex size-14 items-center justify-center overflow-hidden rounded-full border bg-slate-50 text-xs text-slate-400">{preview ? <Image src={preview} alt="" width={56} height={56} unoptimized className="size-full object-contain p-1" /> : "โลโก้"}</span><input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPreview(URL.createObjectURL(file)); setRemoveLogo(false); } }} /></label></div>
      <div><label className="text-xs text-slate-500">ชื่อทีม</label><input name="name" defaultValue={team.name} className="mt-1 w-full rounded-md border px-3 py-2" />{preview && <button type="button" onClick={() => { setPreview(null); setRemoveLogo(true); }} className="mt-1 text-xs text-rose-600 hover:underline">ลบโลโก้</button>}<input type="hidden" name="removeLogo" value={removeLogo ? "1" : "0"} />{state?.error && <p className="mt-1 text-xs text-rose-600">{state.error}</p>}</div>
      <button disabled={pending} className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-slate-400">{pending ? "กำลังบันทึก" : "บันทึก"}</button>
    </form>
  );
}
