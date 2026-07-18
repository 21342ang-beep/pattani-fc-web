export type StandingMatch = {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type StandingRow = {
  rank: number;
  team: string;
  logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type StandingAccumulator = Omit<StandingRow, "rank" | "goalDifference">;

// ตารางคะแนนคำนวณจากผลการแข่งขันที่ผู้ดูแลบันทึกแล้ว
export function buildStandings(matches: StandingMatch[]): StandingRow[] {
  const teams = new Map<string, StandingAccumulator>();

  const getTeam = (team: string, logo: string | null) => {
    const existing = teams.get(team);
    if (existing) {
      if (!existing.logo && logo) existing.logo = logo;
      return existing;
    }

    const created: StandingAccumulator = {
      team,
      logo,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
    teams.set(team, created);
    return created;
  };

  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null) continue;

    const home = getTeam(match.homeTeam, match.homeTeamLogo);
    const away = getTeam(match.awayTeam, match.awayTeamLogo);
    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...teams.values()]
    .map((team) => ({ ...team, goalDifference: team.goalsFor - team.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team, "th"))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}
