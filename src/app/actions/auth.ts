"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { GATE_OFFLINE_REVOKED_COOKIE } from "@/app/(gate)/gate-check/offline-policy";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200),
});

export type LoginState = {
  error?: string;
} | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // กัน brute-force admin: เข้มกว่า customer (5 ครั้ง / 10 นาที / IP)
  const rl = await rateLimit("admin_login", { max: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return {
      error: `พยายามเข้าสู่ระบบบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  // จำกัดซ้ำตามบัญชีเพื่อกัน distributed brute force จากหลาย IP
  // ใช้กับอีเมลที่ parse ผ่านทุกค่า จึงไม่เปิดเผยว่าบัญชีมีอยู่จริงหรือไม่
  const accountRl = await rateLimit("admin_login_account", {
    max: 10,
    windowMs: 30 * 60_000,
    ip: parsed.data.email,
  });
  if (!accountRl.ok) {
    return {
      error: `พยายามเข้าสู่ระบบบ่อยเกินไป ลองอีกครั้งใน ${accountRl.retryAfterSec} วินาที`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // เปรียบเทียบ password เสมอแม้ user ไม่มี เพื่อกัน timing attack
  const dummyHash = "$2b$12$QZJ/HRFVLd4HnZLjo8OBU.j8KD14Szu.WVM20ciuOHbEESySgkRN.";
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyHash);

  if (!user || !ok) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  // A successful fresh login is the only place that removes the Gate logout
  // marker. Cached offline pages cannot silently resurrect the old session.
  (await cookies()).set(GATE_OFFLINE_REVOKED_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  await createSession(user.id, user.role, user.authVersion);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  // The readable marker is not a credential. It is a fail-safe for cached Gate
  // pages if the browser closes before the cleanup redirect finishes.
  (await cookies()).set(GATE_OFFLINE_REVOKED_COOKIE, "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
    priority: "high",
  });
  await deleteSession();
  redirect("/gate-offline-logout");
}
