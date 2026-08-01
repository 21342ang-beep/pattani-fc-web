"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { matchCreateSchema, matchUpdateSchema } from "@/lib/validations";
import { getAdminUser, hasPermission, verifyPermission } from "@/lib/dal";
import { saveTeamLogo, deleteTeamLogo, UploadError } from "@/lib/upload";

export type MatchFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// ค่า datetime-local ไม่มีเขตเวลา จึงกำหนดให้ทุกนัดแข่งขันใช้เวลาไทยเสมอ
// แล้วแปลงเป็น instant ก่อนบันทึก เพื่อไม่ให้เวลาเลื่อนตาม timezone ของ server
function parseBangkokDateTime(v: FormDataEntryValue | null): Date | null {
  const value = emptyToNull(v);
  if (value == null) return null;
  return new Date(`${value}:00+07:00`);
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = emptyToNull(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type LogoResolveResult = {
  path: string | null;
  // ไฟล์ใหม่ที่เพิ่งเซฟ (อาจต้อง rollback ถ้า validation ตก)
  newlyUploaded?: string;
  // ไฟล์เก่าที่ควรลบ "ถ้า" บันทึก DB สำเร็จเท่านั้น
  pendingDelete?: string;
};

async function resolveLogoPath(
  formData: FormData,
  fileField: string,
  existingField: string
): Promise<LogoResolveResult> {
  const file = formData.get(fileField);
  const existing = emptyToNull(formData.get(existingField));

  if (file instanceof File && file.size > 0) {
    const newPath = await saveTeamLogo(file);
    return {
      path: newPath,
      newlyUploaded: newPath,
      pendingDelete: existing ?? undefined,
    };
  }
  if (formData.get(`${fileField}__remove`) === "1") {
    return { path: null, pendingDelete: existing ?? undefined };
  }
  return { path: existing };
}

async function parseFormToMatchInput(formData: FormData) {
  const home = await resolveLogoPath(
    formData,
    "homeTeamLogoFile",
    "homeTeamLogoExisting"
  );
  const away = await resolveLogoPath(
    formData,
    "awayTeamLogoFile",
    "awayTeamLogoExisting"
  );

  const zoneASeats = numOrNull(formData.get("zoneASeats"));
  const zoneBSeats = numOrNull(formData.get("zoneBSeats"));
  const zoneCSeats = numOrNull(formData.get("zoneCSeats"));
  const zoneDSeats = numOrNull(formData.get("zoneDSeats"));
  const zoneESeats = numOrNull(formData.get("zoneESeats"));
  const zoneFSeats = numOrNull(formData.get("zoneFSeats"));
  const zoneGSeats = numOrNull(formData.get("zoneGSeats"));
  const zoneISeats = numOrNull(formData.get("zoneISeats"));
  const zoneJSeats = numOrNull(formData.get("zoneJSeats"));
  const zoneAwaySeats = numOrNull(formData.get("zoneAwaySeats"));
  const homeZoneCapacities = [
    zoneASeats,
    zoneBSeats,
    zoneCSeats,
    zoneDSeats,
    zoneESeats,
    zoneFSeats,
    zoneGSeats,
    zoneISeats,
    zoneJSeats,
  ];
  const hasPerZoneCapacities = homeZoneCapacities.some((capacity) => capacity != null);
  const zoneCapacities = [...homeZoneCapacities, zoneAwaySeats].filter(
    (capacity): capacity is number => capacity != null
  );
  const sum = (...capacities: Array<number | null>) =>
    capacities.reduce<number>((total, capacity) => total + (capacity ?? 0), 0);

  const data = {
    homeTeam: formData.get("homeTeam"),
    awayTeam: formData.get("awayTeam"),
    homeTeamLogo: home.path,
    awayTeamLogo: away.path,
    venue: emptyToNull(formData.get("venue")),
    kickoffAt: parseBangkokDateTime(formData.get("kickoffAt")),
    totalSeats: hasPerZoneCapacities
      ? zoneCapacities.reduce((sum, capacity) => sum + capacity, 0)
      : numOrNull(formData.get("totalSeats")),
    zoneASeats,
    zoneBSeats,
    zoneCSeats,
    zoneDSeats,
    zoneESeats,
    zoneFSeats,
    zoneGSeats,
    zoneISeats,
    zoneJSeats,
    // Keep the old grouped columns in sync for rollback compatibility. Until
    // exact per-zone values are entered, preserve the existing shared pools.
    zone170Seats: hasPerZoneCapacities ? 0 : numOrNull(formData.get("legacyZone170Seats")),
    zone150Seats: hasPerZoneCapacities
      ? sum(zoneASeats, zoneBSeats, zoneFSeats)
      : numOrNull(formData.get("legacyZone150Seats")),
    zone120Seats: hasPerZoneCapacities
      ? sum(zoneCSeats, zoneESeats, zoneGSeats, zoneJSeats)
      : numOrNull(formData.get("legacyZone120Seats")),
    zone100Seats: hasPerZoneCapacities
      ? sum(zoneDSeats, zoneISeats)
      : numOrNull(formData.get("legacyZone100Seats")),
    zoneAwaySeats,
    // ราคาเป็นของโซน ไม่ใช่ของแมตช์ และล้างค่าเก่าจากข้อมูลเดิมด้วย
    pricePerSeat: null,
    competitionType: (formData.get("competitionType") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
  };

  // ไฟล์ที่ต้องลบทิ้งถ้า validation ตก (เพื่อกัน orphan)
  const rollback = [home.newlyUploaded, away.newlyUploaded].filter(
    (x): x is string => typeof x === "string"
  );
  // ไฟล์เก่าที่ต้องลบ "หลัง" DB save สำเร็จ
  const commitDelete = [home.pendingDelete, away.pendingDelete].filter(
    (x): x is string => typeof x === "string"
  );

  return { data, rollback, commitDelete };
}

async function rollbackUploads(paths: string[]) {
  await Promise.all(paths.map((p) => deleteTeamLogo(p)));
}

export async function createMatch(
  _prev: MatchFormState,
  formData: FormData
): Promise<MatchFormState> {
  const user = await getAdminUser();
  if (!hasPermission(user, "MATCHES") && !hasPermission(user, "MATCH_RESULTS")) {
    redirect("/admin");
  }

  let parsedForm;
  try {
    parsedForm = await parseFormToMatchInput(formData);
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "อัปโหลดไฟล์ไม่สำเร็จ" };
  }

  const parsed = matchCreateSchema.safeParse(parsedForm.data);
  if (!parsed.success) {
    await rollbackUploads(parsedForm.rollback);
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.match.create({ data: parsed.data });
  } catch (e) {
    await rollbackUploads(parsedForm.rollback);
    throw e;
  }

  // DB save สำเร็จแล้วค่อยลบไฟล์เก่า (atomicity)
  await rollbackUploads(parsedForm.commitDelete);
  revalidatePath("/admin/matches");
  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath("/matches");
  revalidateTag("matches", { expire: 0 });
  redirect("/admin/matches");
}

export async function updateMatch(
  matchId: string,
  _prev: MatchFormState,
  formData: FormData
): Promise<MatchFormState> {
  await verifyPermission("MATCHES");

  let parsedForm;
  try {
    parsedForm = await parseFormToMatchInput(formData);
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "อัปโหลดไฟล์ไม่สำเร็จ" };
  }

  const parsed = matchUpdateSchema.safeParse(parsedForm.data);
  if (!parsed.success) {
    await rollbackUploads(parsedForm.rollback);
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.match.update({ where: { id: matchId }, data: parsed.data });
  } catch (e) {
    await rollbackUploads(parsedForm.rollback);
    throw e;
  }

  await rollbackUploads(parsedForm.commitDelete);
  revalidatePath("/admin/matches");
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath("/matches");
  revalidateTag("matches", { expire: 0 });
  redirect("/admin/matches");
}

export async function deleteMatch(matchId: string): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("MATCHES");
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
    revalidatePath("/admin/matches");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidateTag("matches", { expire: 0 });
    return { ok: true };
  } catch {
    return { error: "ลบไม่สำเร็จ" };
  }
}
