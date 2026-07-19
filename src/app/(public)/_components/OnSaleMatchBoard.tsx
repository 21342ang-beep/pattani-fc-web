import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Shield } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export type OnSaleMatch = {
  id: string; homeTeam: string; awayTeam: string; homeTeamLogo: string | null;
  awayTeamLogo: string | null; kickoffAt: Date | string | null; venue: string | null;
};

export default function OnSaleMatchBoard({ match, zoneQS = "" }: { match: OnSaleMatch; zoneQS?: string }) {
  return <article className="overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 text-white shadow-xl">
    <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
      <div><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-green-950"><span className="size-2 animate-pulse rounded-full bg-green-950" /> เปิดจองแล้ว</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-7"><Team logo={match.homeTeamLogo} name={match.homeTeam} /><span className="text-lg font-black tracking-[0.2em] text-yellow-300 sm:text-2xl">VS</span><Team logo={match.awayTeamLogo} name={match.awayTeam} /></div>
      </div>
      <div className="border-t border-white/20 pt-5 md:min-w-60 md:border-l md:border-t-0 md:pl-8 md:pt-0"><p className="flex items-center gap-2 text-sm text-emerald-100"><Calendar className="size-4 text-yellow-300" />{match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}</p><p className="mt-2 flex items-center gap-2 text-sm text-emerald-100"><MapPin className="size-4 text-yellow-300" />{match.venue ?? "ยังไม่กำหนดสนาม"}</p><p className="mt-5 text-sm text-emerald-100">ราคา</p><p className="text-2xl font-black text-yellow-300">แยกตามโซน</p><Link href={zoneQS ? `/matches/${match.id}${zoneQS}` : "/tickets#zones"} className="mt-5 block rounded-lg bg-yellow-300 px-5 py-3 text-center text-sm font-bold text-green-950 transition hover:bg-yellow-200">จองตั๋วตอนนี้</Link></div>
    </div>
  </article>;
}
function Team({ logo, name }: { logo: string | null; name: string }) { return <div className="flex min-w-0 flex-col items-center gap-3 text-center"><div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg sm:size-28">{logo ? <Image src={logo} alt={name} width={112} height={112} unoptimized className="size-full object-contain" /> : <Shield className="size-9 text-slate-300" />}</div><h3 className="line-clamp-2 text-base font-black sm:text-xl">{name}</h3></div>; }
