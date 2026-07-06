"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

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

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // เปรียบเทียบ password เสมอแม้ user ไม่มี เพื่อกัน timing attack
  const dummyHash = "$2b$12$QZJ/HRFVLd4HnZLjo8OBU.j8KD14Szu.WVM20ciuOHbEESySgkRN.";
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyHash);

  if (!user || !ok) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  await createSession(user.id, user.role);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
