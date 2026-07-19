import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { buildStandings, LEAGUE_STANDING_TEAMS } from "@/lib/standings";
import StandingsTable from "./StandingsTable";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const { competition } = await searchParams;
  const competitionType = competition === "CUP" ? "CUP" : "LEAGUE";
  const [matches, savedLeagueTeams] = await Promise.all([
    prisma.match.findMany({
      where: { status: "FINISHED", homeScore: { not: null }, awayScore: { not: null }, competitionType },
      orderBy: { kickoffAt: "desc" },
    }),
    competitionType === "LEAGUE"
      ? prisma.leagueTeam.findMany({ orderBy: { sortOrder: "asc" } })
      : Promise.resolve([]),
  ]);
  const leagueTeams = savedLeagueTeams.length > 0
    ? savedLeagueTeams.map((team) => ({ team: team.name, logo: team.logo }))
    : LEAGUE_STANDING_TEAMS;
  const standings = buildStandings(
    matches,
    competitionType === "LEAGUE" ? leagueTeams : [],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ผลการแข่งขัน</h1>
        <p className="text-sm text-slate-600">สรุปผลการแข่งขันและตารางคะแนน</p>
      </header>
      <nav className="flex gap-2" aria-label="ประเภทการแข่งขัน">
        <Link href="/results?competition=LEAGUE" className={`rounded-full px-4 py-2 text-sm font-semibold ${competitionType === "LEAGUE" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลลีก</Link>
        <Link href="/results?competition=CUP" className={`rounded-full px-4 py-2 text-sm font-semibold ${competitionType === "CUP" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลถ้วย</Link>
      </nav>
      <section>
        <h2 className="mb-3 text-xl font-bold text-green-900">ตารางคะแนน {competitionType === "LEAGUE" ? "บอลลีก" : "บอลถ้วย"}</h2>
        <StandingsTable standings={standings} />
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold text-green-900">ผลการแข่งขัน</h2>
        {matches.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-slate-500">ยังไม่มีผลการแข่งขัน</div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <article key={match.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-center text-xs text-slate-500">{match.kickoffAt ? formatDateTime(match.kickoffAt) : "ผลการแข่งขัน"}</p>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                  <h2 className="font-bold text-green-900">{match.homeTeam}</h2>
                  <p className="rounded-lg bg-green-950 px-4 py-2 text-xl font-black text-yellow-300">{match.homeScore} - {match.awayScore}</p>
                  <h2 className="font-bold text-green-900">{match.awayTeam}</h2>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Link href="/matches" className="inline-block text-sm font-semibold text-green-800 hover:underline">ดูโปรแกรมการแข่งขัน →</Link>
    </div>
  );
}
