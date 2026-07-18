"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const scoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0).max(99),
  awayScore: z.coerce.number().int().min(0).max(99),
});

export async function reportMatchResult(matchId: string, formData: FormData) {
  await verifyPermission("MATCH_RESULTS");
  const parsed = scoreSchema.safeParse({
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
  });
  if (!parsed.success) throw new Error("กรุณากรอกสกอร์เป็นตัวเลขตั้งแต่ 0 ถึง 99");

  await prisma.match.update({
    where: { id: matchId },
    data: { ...parsed.data, status: "FINISHED" },
  });

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/results");
  revalidatePath("/admin/matches");
  revalidatePath("/admin/results");
  revalidateTag("matches", { expire: 0 });
  redirect("/admin/results");
}
