"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { changePasswordSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";

export type ChangePasswordState =
  | { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean }
  | undefined;

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await verifyAdmin();
  const attemptLimit = await rateLimit("admin_change_password", {
    max: 5,
    windowMs: 15 * 60_000,
    ip: session.userId,
  });
  if (!attemptLimit.ok) {
    return { error: "ลองยืนยันรหัสผ่านบ่อยเกินไป กรุณารอสักครู่" };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return { error: "ไม่พบผู้ใช้" };
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, authVersion: { increment: 1 } },
    select: { id: true, role: true, authVersion: true },
  });

  // Keep this verified browser signed in while revoking every other cookie.
  await createSession(updated.id, updated.role, updated.authVersion);

  return { ok: true };
}
