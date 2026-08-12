"use server";

import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export type ClearBeamHistoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function clearBeamTransactionHistory(): Promise<ClearBeamHistoryResult> {
  await verifyPermission("ACCOUNT");

  try {
    await prisma.beamAccountingViewState.upsert({
      where: { id: 1 },
      create: { id: 1, hiddenBefore: new Date() },
      update: { hiddenBefore: new Date() },
    });
    revalidatePath("/admin/account/beam");
    return { ok: true };
  } catch (error) {
    console.error("Failed to clear local Beam transaction history", error);
    return { ok: false, error: "ล้างประวัติในระบบไม่สำเร็จ กรุณาลองใหม่" };
  }
}
