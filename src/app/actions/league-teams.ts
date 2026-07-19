"use server";

import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { deleteTeamLogo, saveTeamLogo, UploadError } from "@/lib/upload";

export type LeagueTeamFormState = { error?: string } | undefined;

export async function updateLeagueTeam(
  _previous: LeagueTeamFormState,
  formData: FormData,
): Promise<LeagueTeamFormState> {
  await verifyPermission("MATCH_RESULTS");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder"));
  if (!id || !name || !Number.isInteger(sortOrder) || sortOrder < 1) {
    return { error: "กรุณากรอกชื่อทีมและลำดับให้ถูกต้อง" };
  }

  const current = await prisma.leagueTeam.findUnique({ where: { id } });
  if (!current) return { error: "ไม่พบทีม" };

  let logo = current.logo;
  let newLogo: string | undefined;
  try {
    const upload = formData.get("logoFile");
    if (upload instanceof File && upload.size > 0) {
      newLogo = await saveTeamLogo(upload);
      logo = newLogo;
    } else if (formData.get("removeLogo") === "1") {
      logo = null;
    }
    await prisma.leagueTeam.update({ where: { id }, data: { name, sortOrder, logo } });
  } catch (error) {
    if (newLogo) await deleteTeamLogo(newLogo);
    if (error instanceof UploadError) return { error: error.message };
    return { error: "บันทึกข้อมูลทีมไม่สำเร็จ" };
  }

  if (current.logo && current.logo !== logo) await deleteTeamLogo(current.logo);
  revalidatePath("/admin/results");
  revalidatePath("/admin/results/teams");
  revalidatePath("/results");
  return undefined;
}
