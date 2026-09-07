export function calculateSeasonPassInitialUses(
  seasonMatches: number,
  finalizedBeforeStart: number,
): number {
  const total = Math.max(0, Math.trunc(seasonMatches));
  const elapsed = Math.max(0, Math.trunc(finalizedBeforeStart));
  return Math.max(0, total - Math.min(total, elapsed));
}

export type SeasonPassSettlementBucket = "HOLDER_AT_KICKOFF" | "JOINED_AFTER_MATCH";

export function classifySeasonPassForMatch(
  entitlementStartedAt: Date,
  kickoffAt: Date,
): SeasonPassSettlementBucket {
  return entitlementStartedAt.getTime() <= kickoffAt.getTime()
    ? "HOLDER_AT_KICKOFF"
    : "JOINED_AFTER_MATCH";
}
