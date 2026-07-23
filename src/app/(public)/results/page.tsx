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
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-12 md:py-16 lg:py-20">
      <header>
        <h1 className="text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">ผลการแข่งขัน</h1>
        <p className="mt-2 text-lg text-slate-600 md:text-xl lg:text-2xl">สรุปผลการแข่งขันและตารางคะแนน</p>
      </header>
      <nav className="flex flex-wrap gap-3" aria-label="ประเภทการแข่งขัน">
        <Link href="/results?competition=LEAGUE" className={`rounded-full px-6 py-3 text-lg font-semibold md:px-7 md:py-3.5 md:text-xl ${competitionType === "LEAGUE" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลลีก</Link>
        <Link href="/results?competition=CUP" className={`rounded-full px-6 py-3 text-lg font-semibold md:px-7 md:py-3.5 md:text-xl ${competitionType === "CUP" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลถ้วย</Link>
      </nav>
      <section>
        <h2 className="mb-5 text-3xl font-black text-green-900 md:text-4xl lg:text-5xl">ตารางคะแนน {competitionType === "LEAGUE" ? "บอลลีก" : "บอลถ้วย"}</h2>
        <StandingsTable standings={standings} />
      </section>
      <section>
        <h2 className="mb-5 text-3xl font-black text-green-900 md:text-4xl lg:text-5xl">ผลการแข่งขัน</h2>
        {matches.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-lg text-slate-500 md:text-xl">ยังไม่มีผลการแข่งขัน</div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <article key={match.id} className="rounded-xl border bg-white p-6 shadow-sm md:p-7">
                <p className="text-center text-base text-slate-500 md:text-lg">{match.kickoffAt ? formatDateTime(match.kickoffAt) : "ผลการแข่งขัน"}</p>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center md:gap-6">
                  <h2 className="text-xl font-bold text-green-900 md:text-2xl">{match.homeTeam}</h2>
                  <p className="rounded-lg bg-green-950 px-5 py-3 text-3xl font-black text-yellow-300 md:px-6 md:py-4 md:text-4xl">{match.homeScore} - {match.awayScore}</p>
                  <h2 className="text-xl font-bold text-green-900 md:text-2xl">{match.awayTeam}</h2>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Link href="/matches" className="inline-block text-lg font-semibold text-green-800 hover:underline md:text-xl">ดูโปรแกรมการแข่งขัน →</Link>
    </div>
  );
}
