import type { SeasonTierId } from "@/lib/season-pass-tiers";

export const PUBLIC_SEASON_PASS_TIER_IDS = [
  "vip-advanced",
  "premium",
  "gold",
] as const;

export type PublicSeasonPassTierId = (typeof PUBLIC_SEASON_PASS_TIER_IDS)[number];

export type SeasonPassTierSaleSettings = {
  seasonPassVipAdvancedOpen: boolean;
  seasonPassPremiumOpen: boolean;
  seasonPassGoldOpen: boolean;
};

export function isPublicSeasonPassTierId(tierId: string): tierId is PublicSeasonPassTierId {
  return PUBLIC_SEASON_PASS_TIER_IDS.some((candidate) => candidate === tierId);
}

export function isSeasonPassTierBookingOpen(
  settings: SeasonPassTierSaleSettings,
  tierId: SeasonTierId | string,
) {
  if (tierId === "vip-advanced") return settings.seasonPassVipAdvancedOpen;
  if (tierId === "premium") return settings.seasonPassPremiumOpen;
  if (tierId === "gold") return settings.seasonPassGoldOpen;
  return false;
}

export function getOpenSeasonPassTierIds(settings: SeasonPassTierSaleSettings) {
  return PUBLIC_SEASON_PASS_TIER_IDS.filter((tierId) =>
    isSeasonPassTierBookingOpen(settings, tierId),
  );
}
