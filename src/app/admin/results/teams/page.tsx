import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { LEAGUE_STANDING_TEAMS } from "@/lib/standings";
import LeagueTeamManager from "./LeagueTeamManager";

export default async function LeagueTeamsPage() {
  await verifyPermission("MATCH_RESULTS");
  const existing = await prisma.leagueTeam.findMany({ orderBy: { sortOrder: "asc" } });
  if (existing.length === 0) {
    await prisma.leagueTeam.createMany({
      data: LEAGUE_STANDING_TEAMS.map((team, index) => ({
        name: team.team,
        logo: team.logo ?? null,
        sortOrder: index + 1,
      })),
    });
  }
  const teams = existing.length > 0
    ? existing
    : await prisma.leagueTeam.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/results" className="text-sm text-slate-500 hover:text-slate-900">← กลับหน้าผลการแข่งขัน</Link>
      <div className="mb-6 mt-2">
        <h1 className="text-xl font-bold text-green-900">จัดการตารางคะแนน</h1>
        <p className="mt-1 text-sm text-slate-600">แก้ชื่อทีม อัปโหลดโลโก้ และกำหนดลำดับเริ่มต้นของตารางคะแนน</p>
      </div>
      <LeagueTeamManager teams={teams} />
    </div>
  );
}
