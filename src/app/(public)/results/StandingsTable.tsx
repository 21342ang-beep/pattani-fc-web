import Image from "next/image";
import type { StandingRow } from "@/lib/standings";
import type { Locale } from "@/lib/i18n/dict";
import { localize } from "@/lib/i18n/text";

// โซนอันดับแบบตารางพรีเมียร์ลีก — แถบสีซ้ายแถว + จุดสีในคำอธิบาย
export default function StandingsTable({
  standings,
  showZones = false,
  locale,
}: {
  standings: StandingRow[];
  showZones?: boolean;
  locale: Locale;
}) {
  const t = (th: string, en: string) => localize(locale, th, en);
  const rankZones = [
    { min: 1, max: 2, label: t("อันดับ 1–2 ไปเล่นรายการ AFC", "Ranks 1–2 qualify for AFC competition"), dot: "bg-blue-600" },
    { min: 3, max: 6, label: t("อันดับ 3–6 เพลย์ออฟ", "Ranks 3–6 enter the playoffs"), dot: "bg-amber-500" },
    { min: 14, max: 16, label: t("อันดับ 14–16 ตกชั้น", "Ranks 14–16 are relegated"), dot: "bg-red-600" },
  ];
  const zoneForRank = (rank: number) => rankZones.find((zone) => rank >= zone.min && rank <= zone.max);
  if (standings.length === 0) {
    return <div className="rounded-2xl border border-dashed border-green-200 bg-white px-6 py-10 text-center text-lg text-slate-500 md:text-xl">{t("ตารางคะแนนจะแสดงหลังจากมีการบันทึกผลการแข่งขัน", "Standings will appear after match results are recorded")}</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-green-100 bg-white shadow-sm">
        <table className="min-w-[900px] w-full text-left text-lg md:text-xl">
          <thead className="bg-green-950 text-base font-bold uppercase tracking-wide text-yellow-300 md:text-lg">
            <tr>
              <th aria-hidden className="w-1.5 p-0" /><th className="w-16 px-4 py-4 text-center">{t("อันดับ", "Pos")}</th><th className="px-4 py-4">{t("ทีม", "Team")}</th><th className="px-3 py-4 text-center">{t("แข่ง", "P")}</th><th className="px-3 py-4 text-center">{t("ชนะ", "W")}</th><th className="px-3 py-4 text-center">{t("เสมอ", "D")}</th><th className="px-3 py-4 text-center">{t("แพ้", "L")}</th><th className="px-3 py-4 text-center">{t("ได้", "GF")}</th><th className="px-3 py-4 text-center">{t("เสีย", "GA")}</th><th className="px-3 py-4 text-center">+/-</th><th className="px-4 py-4 text-center">{t("คะแนน", "Pts")}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => {
              const zone = showZones ? zoneForRank(team.rank) : undefined;
              return (
                <tr key={team.team} className="border-t border-green-50 even:bg-green-50/40">
                  <td aria-hidden className={`w-1.5 p-0 ${zone?.dot ?? ""}`} />
                  <td className="px-4 py-4 text-center font-bold text-green-900">{team.rank}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900"><span className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white">{team.logo ? <Image src={team.logo} alt="" width={40} height={40} unoptimized className="size-full object-contain p-0.5" /> : "⚽"}</span>{team.team}</span></td>
                  <td className="px-3 py-4 text-center">{team.played}</td><td className="px-3 py-4 text-center">{team.won}</td><td className="px-3 py-4 text-center">{team.drawn}</td><td className="px-3 py-4 text-center">{team.lost}</td><td className="px-3 py-4 text-center">{team.goalsFor}</td><td className="px-3 py-4 text-center">{team.goalsAgainst}</td><td className="px-3 py-4 text-center">{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</td><td className="px-4 py-4 text-center font-black text-green-800">{team.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showZones && (
        <div className="mt-4 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-green-950 md:text-lg">{t("การผ่านเข้ารอบ/ตกชั้น", "Qualification / Relegation")}</h3>
          <ul className="mt-3 space-y-2">
            {rankZones.map((zone) => (
              <li key={zone.label} className="flex items-center gap-3 text-base text-slate-700 md:text-lg">
                <span aria-hidden className={`size-3 shrink-0 rounded-sm ${zone.dot}`} />
                {zone.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
