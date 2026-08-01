"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { SEASON_LABEL, getSeasonTier } from "@/lib/season-pass-tiers";

export type SeasonPassZoneQuotaState =
  | { success: string; error?: never }
  | { error: string; success?: never }
  | undefined;

function readNonNegativeInteger(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function readOptionalNonNegativeInteger(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? 0 : readNonNegativeInteger(value);
}

export async function updateSeasonPassZoneQuotas(
  _previous: SeasonPassZoneQuotaState,
  formData: FormData,
): Promise<SeasonPassZoneQuotaState> {
  await verifyPermission("MATCHES");

  const tierId = String(formData.get("tierId") ?? "");
  const tier = getSeasonTier(tierId);
  if (!tier?.inventory) return { error: "ไม่พบแพ็กเกจที่ต้องการตั้งค่า" };

  const rows = tier.allowedSeatZones.map((seatZone) => ({
    seatZone,
    totalSeats: readNonNegativeInteger(formData.get(`total:${seatZone}`)),
    sponsorReserved: readOptionalNonNegativeInteger(formData.get(`sponsor:${seatZone}`)),
  }));

  if (rows.some((row) => row.totalSeats == null)) {
    return { error: "กรุณากรอกจำนวนที่นั่งรวมเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไปให้ครบทุกโซน" };
  }
  if (rows.some((row) => row.sponsorReserved == null)) {
    return { error: "จำนวนที่นั่งสปอนเซอร์ต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป หรือเว้นว่างเพื่อใช้ค่า 0" };
  }
  if (rows.some((row) => row.sponsorReserved! > row.totalSeats!)) {
    return { error: "จำนวนที่นั่งสปอนเซอร์ต้องไม่เกินจำนวนที่นั่งรวมของโซน" };
  }

  const totalSeats = rows.reduce((sum, row) => sum + row.totalSeats!, 0);
  const sponsorReserved = rows.reduce((sum, row) => sum + row.sponsorReserved!, 0);
  if (totalSeats !== tier.inventory.total || sponsorReserved !== tier.inventory.sponsorReserved) {
    return {
      error: `แพ็กเกจนี้ต้องจัดสรรรวม ${tier.inventory.total.toLocaleString("th-TH")} ที่ และกันสปอนเซอร์รวม ${tier.inventory.sponsorReserved.toLocaleString("th-TH")} ที่`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Use the same locks as checkout so an allocation cannot be reduced while an order is created.
      for (const row of rows) {
        const lockKey = `${SEASON_LABEL}:${tierId}:${row.seatZone}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      }
      const soldGroups = await tx.seasonPassOrder.groupBy({
        by: ["seatZone"],
        where: {
          seasonLabel: SEASON_LABEL,
          tierId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        _count: { _all: true },
      });
      const soldByZone = new Map(soldGroups.map((row) => [row.seatZone, row._count._all]));
      const belowSold = rows.find(
        (row) => row.totalSeats! - row.sponsorReserved! < (soldByZone.get(row.seatZone) ?? 0),
      );
      if (belowSold) {
        throw new Error(`BELOW_SOLD:${belowSold.seatZone}:${soldByZone.get(belowSold.seatZone) ?? 0}`);
      }

      for (const row of rows) {
        await tx.seasonPassZoneQuota.upsert({
          where: {
            seasonLabel_tierId_seatZone: {
              seasonLabel: SEASON_LABEL,
              tierId,
              seatZone: row.seatZone,
            },
          },
          create: {
            seasonLabel: SEASON_LABEL,
            tierId,
            seatZone: row.seatZone,
            totalSeats: row.totalSeats!,
            sponsorReserved: row.sponsorReserved!,
          },
          update: {
            totalSeats: row.totalSeats!,
            sponsorReserved: row.sponsorReserved!,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BELOW_SOLD:")) {
      const [, seatZone, sold = "0"] = error.message.split(":");
      return { error: `โซน ${seatZone} มีผู้จองแล้ว ${Number(sold).toLocaleString("th-TH")} ที่ จึงลดโควตาขายต่ำกว่านี้ไม่ได้` };
    }
    return { error: "บันทึกโควตาไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath("/admin/matches/season-seats");
  revalidatePath("/season-pass");
  revalidatePath("/season-pass/apply");
  return { success: `บันทึกโควตา ${tier.badge} เรียบร้อยแล้ว` };
}
