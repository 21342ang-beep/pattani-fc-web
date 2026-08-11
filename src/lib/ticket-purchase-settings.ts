import "server-only";
import { prisma } from "@/lib/prisma";

export async function getTicketPurchaseSettings() {
  const settings = await prisma.ticketPurchaseSetting.findUnique({
    where: { id: 1 },
    select: {
      matchMaxQuantity: true,
      seasonPassMaxQuantity: true,
      leagueBookingOpen: true,
      seasonPassBookingOpen: true,
    },
  });
  if (!settings) {
    throw new Error("ยังไม่ได้ตั้งค่าจำนวนตั๋วสูงสุด กรุณารัน Prisma migration");
  }
  return settings;
}
