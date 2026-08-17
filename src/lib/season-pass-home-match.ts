type SeasonPassMatch = {
  homeTeam: string;
  seasonPassEligible: boolean;
};

// บัตรรายปีใช้สิทธิ์เฉพาะเกมเหย้าของ Pattani FC เท่านั้น
export function isPattaniHomeTeam(homeTeam: string): boolean {
  const normalized = homeTeam.trim().toLocaleLowerCase("en-US");
  return (
    normalized === "pattani fc" ||
    normalized === "pattani f.c." ||
    normalized === "pattani" ||
    homeTeam.includes("ปัตตานี เอฟซี")
  );
}

// The database flag lets an admin opt a match in, while the home-team check
// remains a server-side safety guard even if bad data reaches the database.
export function isSeasonPassEligibleMatch(match: SeasonPassMatch): boolean {
  return match.seasonPassEligible && isPattaniHomeTeam(match.homeTeam);
}

// Cup access is an extra benefit. Only league scans consume one of the 15
// league uses printed on the season pass.
export function seasonPassScanConsumesLeagueUse(competitionType: "LEAGUE" | "CUP"): boolean {
  return competitionType === "LEAGUE";
}
