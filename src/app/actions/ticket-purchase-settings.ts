"use server";

import { revalidatePath } from "next/cache";
import type { SeasonPassSalePhase } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAnyPermission, verifyPermission } from "@/lib/dal";

const settingsSchema = z.object({
  matchMaxQuantity: z.number().int().min(1).max(100),
  seasonPassMaxQuantity: z.number().int().min(1).max(100),
});

export type TicketPurchaseSettingsState =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export type TicketSaleType = "LEAGUE";

export async function setTicketSaleOpen(
  saleType: TicketSaleType,
  isOpen: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyPermission("MATCHES");
  if (saleType !== "LEAGUE" || typeof isOpen !== "boolean") {
    return { ok: false, error: "ข้อมูลสถานะการเปิดจองไม่ถูกต้อง" };
  }

  await prisma.ticketPurchaseSetting.update({
    where: { id: 1 },
    data: { leagueBookingOpen: isOpen },
  });

  revalidatePath("/");
  revalidatePath("/admin/matches");
  revalidatePath("/matches");
  revalidatePath("/tickets");
  revalidatePath("/tickets/season");
  revalidatePath("/season-pass/apply");
  return { ok: true };
}

const seasonPassSalePhases = new Set<SeasonPassSalePhase>([
  "STAFF_ONLY",
  "PUBLIC_OPEN",
  "CLOSED",
]);

export async function setSeasonPassSalePhase(
  phase: SeasonPassSalePhase,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyPermission("MATCHES");
  if (!seasonPassSalePhases.has(phase)) {
    return { ok: false, error: "สถานะการขายบัตรรายปีไม่ถูกต้อง" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('season-pass-sale-phase'))::text AS lock_result`;
    await tx.ticketPurchaseSetting.update({
      where: { id: 1 },
      data: {
        seasonPassSalePhase: phase,
        seasonPassBookingOpen: phase === "PUBLIC_OPEN",
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/admin/matches");
  revalidatePath("/admin/season-passes/staff");
  revalidatePath("/tickets/season");
  revalidatePath("/season-pass/apply");
  return { ok: true };
}

export async function updateTicketPurchaseSettings(
  _previous: TicketPurchaseSettingsState,
  formData: FormData,
): Promise<TicketPurchaseSettingsState> {
  await verifyAnyPermission(["MATCHES", "SEASON_PASSES"]);
  const parsed = settingsSchema.safeParse({
    matchMaxQuantity: Number(formData.get("matchMaxQuantity")),
    seasonPassMaxQuantity: Number(formData.get("seasonPassMaxQuantity")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "กรุณากำหนดจำนวนระหว่าง 1–100 ใบ",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.ticketPurchaseSetting.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/admin/ticket-settings");
  revalidatePath("/matches");
  revalidatePath("/tickets/season");
  return { ok: true, message: "บันทึกจำนวนสูงสุดเรียบร้อยแล้ว" };
}
