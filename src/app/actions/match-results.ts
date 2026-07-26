"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { saveTeamLogo, deleteTeamLogo, isValidLogoPath, UploadError } from "@/lib/upload";

const scoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0).max(99),
  awayScore: z.coerce.number().int().min(0).max(99),
});

const resultMatchSchema = z.object({
  homeTeam: z.string().trim().min(1).max(100),
  awayTeam: z.string().trim().min(1).max(100),
  kickoffAt: z.coerce.date().nullish(),
  competitionType: z.enum(["LEAGUE", "CUP"]).catch("LEAGUE"),
});

function isPattaniFixture(homeTeam: string, awayTeam: string): boolean {
  const isPattaniTeam = (team: string) => {
    const normalized = team.trim().toLocaleLowerCase("th-TH");
    return normalized.includes("pattani") || normalized.includes("ปัตตานี");
  };
  return isPattaniTeam(homeTeam) || isPattaniTeam(awayTeam);
}

export type ResultMatchFormState = { error?: string } | undefined;

function parseResultMatchFields(formData: FormData) {
  const kickoffRaw = formData.get("kickoffAt");
  return resultMatchSchema.safeParse({
    homeTeam: formData.get("homeTeam"),
    awayTeam: formData.get("awayTeam"),
    kickoffAt: typeof kickoffRaw === "string" && kickoffRaw.trim() !== "" ? kickoffRaw : null,
    competitionType: formData.get("competitionType"),
  });
}

type LogoResolve = {
  path: string | null;
  // ไฟล์ใหม่ที่เพิ่งเซฟ — ต้อง rollback ถ้าบันทึก DB ไม่สำเร็จ
  newlyUploaded?: string;
  // ไฟล์เก่าที่ควรลบ "หลัง" บันทึก DB สำเร็จเท่านั้น
  pendingDelete?: string;
};

async function resolveLogo(
  formData: FormData,
  fileField: string,
  existingField: string
): Promise<LogoResolve> {
  const existingRaw = formData.get(existingField);
  const existing =
    typeof existingRaw === "string" && isValidLogoPath(existingRaw.trim())
      ? existingRaw.trim()
      : null;
  const file = formData.get(fileField);
  if (file instanceof File && file.size > 0) {
    const newPath = await saveTeamLogo(file);
    return { path: newPath, newlyUploaded: newPath, pendingDelete: existing ?? undefined };
  }
  if (formData.get(`${fileField}__remove`) === "1") {
    return { path: null, pendingDelete: existing ?? undefined };
  }
  return { path: existing };
}

// อัปโหลดโล้โก้ทั้งสองฝั่ง — ถ้าฝั่งใดพลาด ลบไฟล์ที่เพิ่งอัปไปแล้วทิ้งกัน orphan
async function resolveBothLogos(formData: FormData) {
  const uploaded: string[] = [];
  try {
    const home = await resolveLogo(formData, "homeTeamLogoFile", "homeTeamLogoExisting");
    if (home.newlyUploaded) uploaded.push(home.newlyUploaded);
    const away = await resolveLogo(formData, "awayTeamLogoFile", "awayTeamLogoExisting");
    if (away.newlyUploaded) uploaded.push(away.newlyUploaded);
    return { home, away, uploaded };
  } catch (e) {
    await Promise.all(uploaded.map((p) => deleteTeamLogo(p)));
    throw e;
  }
}

function revalidateMatchPages() {
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/results");
  revalidatePath("/admin/matches");
  revalidatePath("/admin/results");
  revalidateTag("matches", { expire: 0 });
}

export async function createResultMatch(
  _prev: ResultMatchFormState,
  formData: FormData
): Promise<ResultMatchFormState> {
  await verifyPermission("MATCH_RESULTS");
  const parsed = parseResultMatchFields(formData);
  if (!parsed.success) return { error: "กรุณากรอกชื่อทีมเหย้าและทีมเยือนให้ถูกต้อง" };
  if (!isPattaniFixture(parsed.data.homeTeam, parsed.data.awayTeam)) {
    return { error: "บันทึกผลได้เฉพาะแมตช์ที่มีปัตตานี เอฟซี ลงแข่งขัน" };
  }

  let logos;
  try {
    logos = await resolveBothLogos(formData);
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "อัปโหลดไฟล์ไม่สำเร็จ" };
  }

  try {
    await prisma.match.create({
      data: {
        ...parsed.data,
        homeTeamLogo: logos.home.path,
        awayTeamLogo: logos.away.path,
        status: "SCHEDULED",
        isResultOnly: true,
      },
    });
  } catch (e) {
    await Promise.all(logos.uploaded.map((p) => deleteTeamLogo(p)));
    throw e;
  }

  revalidateMatchPages();
  redirect(`/admin/results?competition=${parsed.data.competitionType}`);
}

export async function updateResultMatch(
  matchId: string,
  _prev: ResultMatchFormState,
  formData: FormData
): Promise<ResultMatchFormState> {
  await verifyPermission("MATCH_RESULTS");
  const parsed = parseResultMatchFields(formData);
  if (!parsed.success) return { error: "กรุณากรอกชื่อทีมเหย้าและทีมเยือนให้ถูกต้อง" };
  if (!isPattaniFixture(parsed.data.homeTeam, parsed.data.awayTeam)) {
    return { error: "บันทึกผลได้เฉพาะแมตช์ที่มีปัตตานี เอฟซี ลงแข่งขัน" };
  }

  // สกอร์: กรอกครบทั้งคู่ = บันทึก/แก้ผล, ว่างทั้งคู่ = ยกเลิกผลที่บันทึกไว้
  const homeScoreRaw = formData.get("homeScore");
  const awayScoreRaw = formData.get("awayScore");
  const homeScoreEmpty = typeof homeScoreRaw !== "string" || homeScoreRaw.trim() === "";
  const awayScoreEmpty = typeof awayScoreRaw !== "string" || awayScoreRaw.trim() === "";
  if (homeScoreEmpty !== awayScoreEmpty) {
    return { error: "กรอกสกอร์ให้ครบทั้งสองฝั่ง หรือเว้นว่างทั้งคู่" };
  }
  let scoreData: { homeScore: number | null; awayScore: number | null; status?: "FINISHED" | "SCHEDULED" };
  if (homeScoreEmpty) {
    const current = await prisma.match.findUnique({
      where: { id: matchId },
      select: { status: true },
    });
    scoreData = {
      homeScore: null,
      awayScore: null,
      // ถอยสถานะเฉพาะแมตช์ที่จบไปแล้ว — ไม่แตะสถานะอื่น (เช่น เปิดจองอยู่)
      ...(current?.status === "FINISHED" ? { status: "SCHEDULED" as const } : {}),
    };
  } else {
    const parsedScore = scoreSchema.safeParse({ homeScore: homeScoreRaw, awayScore: awayScoreRaw });
    if (!parsedScore.success) return { error: "กรุณากรอกสกอร์เป็นตัวเลขตั้งแต่ 0 ถึง 99" };
    scoreData = { ...parsedScore.data, status: "FINISHED" };
  }

  let logos;
  try {
    logos = await resolveBothLogos(formData);
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "อัปโหลดไฟล์ไม่สำเร็จ" };
  }

  try {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        homeTeam: parsed.data.homeTeam,
        awayTeam: parsed.data.awayTeam,
        kickoffAt: parsed.data.kickoffAt,
        homeTeamLogo: logos.home.path,
        awayTeamLogo: logos.away.path,
        ...scoreData,
      },
    });
  } catch (e) {
    await Promise.all(logos.uploaded.map((p) => deleteTeamLogo(p)));
    throw e;
  }

  // DB สำเร็จแล้วค่อยลบไฟล์เก่าที่ถูกแทนที่/ถูกกดลบ
  const pendingDelete = [logos.home.pendingDelete, logos.away.pendingDelete].filter(
    (p): p is string => typeof p === "string"
  );
  await Promise.all(pendingDelete.map((p) => deleteTeamLogo(p)));

  revalidateMatchPages();
  redirect(`/admin/results?competition=${parsed.data.competitionType}`);
}

export async function deleteResultMatch(
  matchId: string
): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("MATCH_RESULTS");
  try {
    const bookings = await prisma.booking.count({
      where: { matchId, status: { in: ["PENDING", "CONFIRMED"] } },
    });
    if (bookings > 0) {
      return { error: "ลบไม่ได้: มีการจองที่ยังใช้งานอยู่ ยกเลิกการจองก่อน" };
    }
    const m = await prisma.match.findUnique({
      where: { id: matchId },
      select: { homeTeamLogo: true, awayTeamLogo: true },
    });
    await prisma.match.delete({ where: { id: matchId } });
    if (m?.homeTeamLogo) await deleteTeamLogo(m.homeTeamLogo);
    if (m?.awayTeamLogo) await deleteTeamLogo(m.awayTeamLogo);
    revalidateMatchPages();
    return { ok: true };
  } catch {
    return { error: "ลบไม่สำเร็จ" };
  }
}

export async function reportMatchResult(matchId: string, formData: FormData) {
  await verifyPermission("MATCH_RESULTS");
  const parsed = scoreSchema.safeParse({
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
  });
  if (!parsed.success) throw new Error("กรุณากรอกสกอร์เป็นตัวเลขตั้งแต่ 0 ถึง 99");

  const match = await prisma.match.update({
    where: { id: matchId },
    data: { ...parsed.data, status: "FINISHED" },
    select: { competitionType: true },
  });

  revalidateMatchPages();
  redirect(`/admin/results?competition=${match.competitionType}`);
}
