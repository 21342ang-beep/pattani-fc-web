"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { SEASON_LABEL, SEASON_TIERS } from "@/lib/season-pass-tiers";

const createBarcodeSchema = z.object({
  tierId: z.enum(["vip-advanced", "premium", "gold"]),
  quantity: z.coerce.number().int().min(1).max(500),
});

type BarcodeTierId = z.infer<typeof createBarcodeSchema>["tierId"];

export type CreateBarcodesState =
  | { ok: false; message: string; barcodes: [] }
  | {
      ok: true;
      message: string;
      barcodes: {
        sequence: number;
        barcode: string;
        packagePrice: number;
        tierId: BarcodeTierId;
      }[];
    };

export async function createSeasonPassBarcodes(
  _previousState: CreateBarcodesState,
  formData: FormData,
): Promise<CreateBarcodesState> {
  await verifyPermission("BARCODE_MANAGEMENT");

  const parsed = createBarcodeSchema.safeParse({
    tierId: formData.get("tierId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { ok: false, message: "กรุณาเลือกแพ็กเกจและระบุจำนวน 1–500 ใบ", barcodes: [] };
  }

  const tierId = parsed.data.tierId;
  const tier = SEASON_TIERS.find((item) => item.id === tierId);
  if (!tier) {
    return { ok: false, message: "ไม่พบแพ็กเกจที่เลือก", barcodes: [] };
  }

  try {
    const barcodes = await prisma.$transaction(async (tx) => {
      const prefix = `PFC26-${tier.priceBaht}-`;
      const prepared = await tx.seasonPassBarcode.findMany({
        where: {
          tierId: tier.id,
          barcode: { startsWith: prefix },
          isGenerated: false,
          orderId: null,
        },
        orderBy: { barcode: "asc" },
        take: parsed.data.quantity,
        select: { id: true, barcode: true },
      });
      if (prepared.length > 0) {
        const marked = await tx.seasonPassBarcode.updateMany({
          where: { id: { in: prepared.map((item) => item.id) }, isGenerated: false, orderId: null },
          data: { isGenerated: true },
        });
        if (marked.count !== prepared.length) throw new Error("BARCODE_CONFLICT");
      }

      const remaining = parsed.data.quantity - prepared.length;
      const latest = await tx.seasonPassBarcode.findFirst({
        where: { tierId: tier.id, barcode: { startsWith: prefix } },
        orderBy: { barcode: "desc" },
        select: { barcode: true },
      });
      const latestSequence = latest
        ? Number.parseInt(latest.barcode.split("-").at(-1) ?? "0", 10)
        : 0;
      const finalSequence = latestSequence + remaining;
      if (finalSequence > 9999) throw new Error("BARCODE_LIMIT");

      const newCodes = Array.from({ length: remaining }, (_, index) => {
        const sequence = latestSequence + index + 1;
        return {
          sequence,
          barcode: `PFC26-${tier.priceBaht}-${String(sequence).padStart(4, "0")}`,
          tierId: tier.id,
          seasonLabel: SEASON_LABEL,
          isGenerated: true,
        };
      });
      if (newCodes.length > 0) {
        await tx.seasonPassBarcode.createMany({
          data: newCodes.map(({ barcode, tierId, seasonLabel, isGenerated }) => ({
            barcode,
            tierId,
            seasonLabel,
            isGenerated,
          })),
        });
      }
      return [...prepared.map(({ barcode }) => ({
        sequence: Number.parseInt(barcode.split("-").at(-1) ?? "0", 10),
        barcode,
      })), ...newCodes.map(({ sequence, barcode }) => ({ sequence, barcode }))]
        .sort((a, b) => a.sequence - b.sequence)
        .map(({ sequence, barcode }) => ({
        sequence,
        barcode,
        packagePrice: tier.priceBaht,
        tierId,
      }));
    });

    revalidatePath("/admin/barcodes/create");
    revalidatePath("/admin/season-passes");
    return {
      ok: true,
      message: `สร้างบาร์โค้ดแพ็กเกจ ${tier.priceBaht.toLocaleString("th-TH")} จำนวน ${barcodes.length.toLocaleString("th-TH")} ใบแล้ว`,
      barcodes,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "BARCODE_LIMIT") {
      return { ok: false, message: "หมายเลขบาร์โค้ดของแพ็กเกจนี้เต็มแล้ว", barcodes: [] };
    }
    return { ok: false, message: "สร้างบาร์โค้ดไม่สำเร็จ กรุณาลองใหม่", barcodes: [] };
  }
}

export async function deleteSeasonPassBarcodes(
  barcodes: string[],
): Promise<{ ok: true; deleted: number } | { ok: false; message: string }> {
  await verifyPermission("BARCODE_MANAGEMENT");

  const parsed = z
    .array(z.string().regex(/^PFC26-(2500|2000|1500)-\d{4}$/))
    .min(1)
    .max(500)
    .safeParse([...new Set(barcodes)]);
  if (!parsed.success) {
    return { ok: false, message: "รายการบาร์โค้ดไม่ถูกต้อง" };
  }

  const deletable = await prisma.seasonPassBarcode.count({
    where: { barcode: { in: parsed.data }, orderId: null, isGenerated: true },
  });
  if (deletable !== parsed.data.length) {
    return { ok: false, message: "มีบาร์โค้ดบางรายการถูกใช้งานแล้ว จึงลบไม่ได้" };
  }

  await prisma.seasonPassBarcode.deleteMany({
    where: { barcode: { in: parsed.data }, orderId: null, isGenerated: true },
  });
  revalidatePath("/admin/barcodes/create");
  revalidatePath("/admin/season-passes");
  return { ok: true, deleted: parsed.data.length };
}
