import "server-only";
import { prisma } from "@/lib/prisma";
import { getOpenSeasonPassTierIds } from "@/lib/season-pass-sale-policy";

export function isMatchTicketBookingOpen(
  match: { competitionType: string },
  settings: { leagueBookingOpen: boolean },
) {
  return match.competitionType !== "LEAGUE" || settings.leagueBookingOpen;
}

export async function getTicketPurchaseSettings() {
  const settings = await prisma.ticketPurchaseSetting.findUnique({
    where: { id: 1 },
    select: {
      matchMaxQuantity: true,
      seasonPassMaxQuantity: true,
      leagueBookingOpen: true,
      seasonPassSalePhase: true,
      seasonPassVipAdvancedOpen: true,
      seasonPassPremiumOpen: true,
      seasonPassGoldOpen: true,
    },
  });
  if (!settings) {
    throw new Error("ยังไม่ได้ตั้งค่าจำนวนตั๋วสูงสุด กรุณารัน Prisma migration");
  }
  const seasonPassOpenTierIds = getOpenSeasonPassTierIds(settings);
  return {
    ...settings,
    seasonPassOpenTierIds,
    seasonPassBookingOpen: seasonPassOpenTierIds.length > 0,
  };
}
