import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { buildStandings, LEAGUE_STANDING_TEAMS } from "@/lib/standings";
import { reportMatchResult } from "@/app/actions/match-results";
import StandingsTable from "@/app/(public)/results/StandingsTable";

export const dynamic = "force-dynamic";

export default async function AdminMatchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  await verifyPermission("MATCH_RESULTS");
  const { competition } = await searchParams;
  const competitionType = competition === "CUP" ? "CUP" : "LEAGUE";
  const matches = await prisma.match.findMany({
    where: { status: { not: "CANCELLED" }, competitionType },
    orderBy: { kickoffAt: "desc" },
  });
  const savedLeagueTeams = competitionType === "LEAGUE"
    ? await prisma.leagueTeam.findMany({ orderBy: { sortOrder: "asc" } })
    : [];
  const configuredLeagueTeams = savedLeagueTeams.length > 0
    ? savedLeagueTeams.map((team) => ({ team: team.name, logo: team.logo }))
    : LEAGUE_STANDING_TEAMS;
  const leagueTeamsWithLogos = configuredLeagueTeams.map((team) => {
    const logoMatch = matches.find(
      (match) => match.homeTeam === team.team && match.homeTeamLogo,
    ) ?? matches.find(
      (match) => match.awayTeam === team.team && match.awayTeamLogo,
    );
    return {
      ...team,
      logo:
        logoMatch?.homeTeam === team.team
          ? logoMatch.homeTeamLogo
          : logoMatch?.awayTeamLogo ?? team.logo,
    };
  });
  const standings = buildStandings(
    matches.filter((match) => match.status === "FINISHED"),
    competitionType === "LEAGUE" ? leagueTeamsWithLogos : [],
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">← กลับหน้าหลังบ้าน</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">รายงานผลการแข่งขัน</h1>
          <p className="mt-1 text-sm text-slate-600">บันทึกสกอร์ และตารางคะแนนจะคำนวณให้อัตโนมัติ</p>
        </div>
        <Link href="/admin/results/teams" className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">จัดการตารางคะแนน</Link>
      </div>

      <nav className="mb-6 flex gap-2" aria-label="ประเภทการแข่งขัน">
        <Link href="/admin/results?competition=LEAGUE" className={`rounded-full px-4 py-2 text-sm font-semibold ${competitionType === "LEAGUE" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลลีก</Link>
        <Link href="/admin/results?competition=CUP" className={`rounded-full px-4 py-2 text-sm font-semibold ${competitionType === "CUP" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลถ้วย</Link>
      </nav>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-green-900">ตารางคะแนน {competitionType === "LEAGUE" ? "บอลลีก" : "บอลถ้วย"}</h2>
        <StandingsTable standings={standings} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-green-900">บันทึกผลการแข่งขัน</h2>
        {matches.map((match) => {
          const action = reportMatchResult.bind(null, match.id);
          return (
            <form key={match.id} action={action} className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
              <div className="min-w-56 flex-1">
                <p className="font-bold text-slate-900">{match.homeTeam} <span className="text-slate-400">vs</span> {match.awayTeam}</p>
                <p className="mt-1 text-xs text-slate-500">{match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`home-score-${match.id}`}>สกอร์ทีมเหย้า</label>
                <input id={`home-score-${match.id}`} name="homeScore" type="number" min="0" max="99" required defaultValue={match.homeScore ?? ""} className="w-16 rounded-md border px-2 py-2 text-center font-bold" />
                <span className="font-bold text-slate-400">-</span>
                <label className="sr-only" htmlFor={`away-score-${match.id}`}>สกอร์ทีมเยือน</label>
                <input id={`away-score-${match.id}`} name="awayScore" type="number" min="0" max="99" required defaultValue={match.awayScore ?? ""} className="w-16 rounded-md border px-2 py-2 text-center font-bold" />
              </div>
              <button type="submit" className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">บันทึกผล</button>
            </form>
          );
        })}
        {matches.length === 0 && <p className="rounded-lg border bg-white p-6 text-center text-slate-500">ยังไม่มีแมตช์สำหรับรายงานผล</p>}
      </section>
    </div>
  );
}
