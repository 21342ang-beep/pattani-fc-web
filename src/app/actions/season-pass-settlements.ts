"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  previewSeasonPassMatchSettlement,
  reverseSeasonPassMatchSettlement,
  settleSeasonPassMatch,
  type SeasonPassSettlementPreview,
} from "@/lib/season-pass-match-finalization";

const matchIdSchema = z.string().trim().min(1).max(100);

export type SeasonPassSettlementPreviewDto = Omit<
  SeasonPassSettlementPreview,
  "kickoffAt" | "finalizedAt"
> & {
  kickoffAt: string | null;
  finalizedAt: string | null;
};

type PreviewResult =
  | { ok: true; preview: SeasonPassSettlementPreviewDto }
  | { ok: false; error: string };

type MutationResult =
  | { ok: true; preview: SeasonPassSettlementPreviewDto; message: string }
  | { ok: false; error: string };

function toDto(preview: SeasonPassSettlementPreview): SeasonPassSettlementPreviewDto {
  return {
    ...preview,
    kickoffAt: preview.kickoffAt?.toISOString() ?? null,
    finalizedAt: preview.finalizedAt?.toISOString() ?? null,
  };
}

function settlementErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
  if (error.message === "MATCH_NOT_FOUND") return "ไม่พบแมตช์นี้";
  if (error.message.startsWith("MATCH_NOT_SETTLEABLE:")) {
    return error.message.slice("MATCH_NOT_SETTLEABLE:".length);
  }
  if (error.message === "SEASON_PASS_ENTITLEMENT_INCOMPLETE") {
    return "ยังมีบัตรที่ยืนยันแล้วแต่ไม่มีบาร์โค้ดหรือวันเริ่มสิทธิ์ จึงยังไม่ตัดสิทธิ์เพื่อป้องกันข้อมูลลูกค้าคลาดเคลื่อน";
  }
  if (
    error.message === "SEASON_PASS_SETTLEMENT_COUNT_MISMATCH" ||
    error.message === "SEASON_PASS_SETTLEMENT_RESTORE_MISMATCH"
  ) {
    return "จำนวนบัตรเปลี่ยนระหว่างดำเนินการ ระบบยกเลิกทั้งหมดแล้ว กรุณาตรวจสอบและลองใหม่";
  }
  if ("code" in error && error.code === "P2034") {
    return "มีรายการสแกนหรือการชำระเงินเกิดขึ้นพร้อมกัน ระบบยังไม่เปลี่ยนข้อมูล กรุณาตรวจสอบใหม่";
  }
  return "ดำเนินการไม่สำเร็จ ระบบยังไม่เปลี่ยนข้อมูล กรุณาลองใหม่";
}

function revalidateSeasonPassSettlementPages() {
  revalidatePath("/admin/matches");
  revalidatePath("/admin/season-passes");
  revalidatePath("/admin/season-passes/check");
  revalidatePath("/season-pass/apply");
  revalidatePath("/tickets/season");
  revalidateTag("bookings", { expire: 0 });
}

export async function previewSeasonPassSettlement(matchId: string): Promise<PreviewResult> {
  await verifyPermission("MATCHES");
  const parsed = matchIdSchema.safeParse(matchId);
  if (!parsed.success) return { ok: false, error: "รหัสแมตช์ไม่ถูกต้อง" };

  try {
    const preview = await prisma.$transaction((tx) =>
      previewSeasonPassMatchSettlement(tx, parsed.data),
    );
    return { ok: true, preview: toDto(preview) };
  } catch (error) {
    return { ok: false, error: settlementErrorMessage(error) };
  }
}

export async function confirmSeasonPassSettlement(matchId: string): Promise<MutationResult> {
  const user = await verifyPermission("MATCHES");
  const parsed = matchIdSchema.safeParse(matchId);
  if (!parsed.success) return { ok: false, error: "รหัสแมตช์ไม่ถูกต้อง" };

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const result = await settleSeasonPassMatch(tx, parsed.data, user.id);
        const preview = await previewSeasonPassMatchSettlement(tx, parsed.data);
        return { result, preview };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
    revalidateSeasonPassSettlementPages();
    return {
      ok: true,
      preview: toDto(outcome.preview),
      message: outcome.result.alreadySettled
        ? "แมตช์นี้ตัดสิทธิ์เรียบร้อยแล้ว ไม่มีการหักซ้ำ"
        : `ตัดสิทธิ์สำเร็จ ${outcome.result.missedCount + outcome.result.postMatchCount} ใบ โดยไม่หักบัตรที่สแกนแล้วซ้ำ`,
    };
  } catch (error) {
    return { ok: false, error: settlementErrorMessage(error) };
  }
}

export async function undoSeasonPassSettlement(matchId: string): Promise<MutationResult> {
  const user = await verifyPermission("MATCHES");
  const parsed = matchIdSchema.safeParse(matchId);
  if (!parsed.success) return { ok: false, error: "รหัสแมตช์ไม่ถูกต้อง" };

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const restored = await reverseSeasonPassMatchSettlement(tx, parsed.data, user.id);
        const preview = await previewSeasonPassMatchSettlement(tx, parsed.data);
        return { restored, preview };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
    revalidateSeasonPassSettlementPages();
    return {
      ok: true,
      preview: toDto(outcome.preview),
      message: `คืนสิทธิ์สำเร็จ ${outcome.restored.restoredAbsences + outcome.restored.restoredLaterBuyers} ใบ บัตรที่เคยสแกนยังคงเดิม`,
    };
  } catch (error) {
    return { ok: false, error: settlementErrorMessage(error) };
  }
}
