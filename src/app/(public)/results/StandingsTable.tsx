import Image from "next/image";
import type { StandingRow } from "@/lib/standings";

export default function StandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return <div className="rounded-2xl border border-dashed border-green-200 bg-white px-6 py-10 text-center text-slate-500">ตารางคะแนนจะแสดงหลังจากมีการบันทึกผลการแข่งขัน</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-green-100 bg-white shadow-sm">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="bg-green-950 text-xs font-bold uppercase tracking-wide text-yellow-300">
          <tr>
            <th className="w-14 px-4 py-3 text-center">อันดับ</th><th className="px-4 py-3">ทีม</th><th className="px-3 py-3 text-center">แข่ง</th><th className="px-3 py-3 text-center">ชนะ</th><th className="px-3 py-3 text-center">เสมอ</th><th className="px-3 py-3 text-center">แพ้</th><th className="px-3 py-3 text-center">ได้</th><th className="px-3 py-3 text-center">เสีย</th><th className="px-3 py-3 text-center">+/-</th><th className="px-4 py-3 text-center">คะแนน</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => (
            <tr key={team.team} className="border-t border-green-50 even:bg-green-50/40">
              <td className="px-4 py-3 text-center font-bold text-green-900">{team.rank}</td>
              <td className="px-4 py-3 font-semibold text-slate-900"><span className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white">{team.logo ? <Image src={team.logo} alt="" width={32} height={32} unoptimized className="size-full object-contain p-0.5" /> : "⚽"}</span>{team.team}</span></td>
              <td className="px-3 py-3 text-center">{team.played}</td><td className="px-3 py-3 text-center">{team.won}</td><td className="px-3 py-3 text-center">{team.drawn}</td><td className="px-3 py-3 text-center">{team.lost}</td><td className="px-3 py-3 text-center">{team.goalsFor}</td><td className="px-3 py-3 text-center">{team.goalsAgainst}</td><td className="px-3 py-3 text-center">{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</td><td className="px-4 py-3 text-center font-black text-green-800">{team.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
