"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAnyPermission } from "@/lib/dal";

const settingsSchema = z.object({
  matchMaxQuantity: z.number().int().min(1).max(100),
  seasonPassMaxQuantity: z.number().int().min(1).max(100),
});

export type TicketPurchaseSettingsState =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | undefined;

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
