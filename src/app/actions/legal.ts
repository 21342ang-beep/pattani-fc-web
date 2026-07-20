"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dal";

export type LegalUploadState = { error?: string; ok?: boolean } | undefined;

export async function uploadSalesTermsPdf(
  _previous: LegalUploadState,
  formData: FormData,
): Promise<LegalUploadState> {
  await verifyPermission("WEBSITE");
  const file = formData.get("salesTermsPdf");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "กรุณาเลือกไฟล์ PDF" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "ไฟล์ต้องมีขนาดไม่เกิน 10MB" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (file.type !== "application/pdf" || header !== "%PDF-") {
    return { error: "รองรับเฉพาะไฟล์ PDF ที่ถูกต้องเท่านั้น" };
  }

  const directory = path.join(process.cwd(), "public", "uploads", "legal");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "pattani-fc-sales-terms.pdf"), bytes);
  revalidatePath("/privacy-policy");
  revalidatePath("/admin/website/sales-terms");
  return { ok: true };
}
