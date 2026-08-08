"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const COOKIE = "customer_password_reset";
const TTL_MS = 10 * 60_000;
const phoneSchema = z.string().trim().regex(/^[0-9+\-\s()]{9,20}$/);
const passwordSchema = z.string().min(8).max(200).regex(/[A-Za-z]/).regex(/[0-9]/);

export type PasswordResetState = { error?: string; requested?: true; reset?: true } | undefined;

function credentials() {
  const key = process.env.THAIBULKSMS_OTP_KEY;
  const secret = process.env.THAIBULKSMS_OTP_SECRET;
  return key && secret ? { key, secret } : null;
}

export async function requestCustomerPasswordReset(_prev: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const rl = await rateLimit("customer_password_reset_request", { max: 3, windowMs: 15 * 60_000 });
  if (!rl.ok) return { error: "ส่งรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง" };
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) return { error: "กรุณากรอกเบอร์มือถือที่ใช้สมัคร" };
  const phone = parsed.data.replace(/\D/g, "").replace(/^66(?=\d{9}$)/, "0");
  if (!/^0[689]\d{8}$/.test(phone)) return { error: "กรุณากรอกเบอร์มือถือไทย 10 หลัก" };
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Customer" WHERE regexp_replace(coalesce("phone", ''), '\\D', '', 'g') IN (${phone}, ${`66${phone.slice(1)}`}) LIMIT 1`;
  const customer = rows[0];
  // Do not reveal whether this phone is registered.
  if (!customer) return { requested: true };
  const auth = credentials();
  if (!auth) return { error: "ระบบ OTP ยังไม่พร้อมใช้งาน" };
  try {
    const response = await fetch("https://otp.thaibulksms.com/v2/otp/request", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key: auth.key, secret: auth.secret, msisdn: phone }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const data = await response.json().catch(() => null) as { status?: string; token?: string } | null;
    if (!response.ok || data?.status !== "success" || !data.token) return { error: "ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่" };
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TTL_MS);
    await prisma.$executeRaw`INSERT INTO "CustomerPasswordResetOtp" ("id", "customerId", "providerToken", "expiresAt") VALUES (${id}, ${customer.id}, ${data.token}, ${expiresAt})`;
    (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/member", expires: expiresAt });
    return { requested: true };
  } catch { return { error: "เชื่อมต่อระบบ OTP ไม่สำเร็จ" }; }
}

export async function resetCustomerPassword(_prev: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const pin = String(formData.get("pin") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!/^\d{4,8}$/.test(pin)) return { error: "กรุณากรอกรหัส OTP" };
  if (!passwordSchema.safeParse(password).success) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัว และมีตัวอักษรกับตัวเลข" };
  if (password !== confirmPassword) return { error: "ยืนยันรหัสผ่านไม่ตรงกัน" };
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return { error: "ไม่พบคำขอรีเซ็ต กรุณาขอ OTP ใหม่" };
  const rows = await prisma.$queryRaw<{ customerId: string; providerToken: string }[]>`SELECT "customerId", "providerToken" FROM "CustomerPasswordResetOtp" WHERE "id" = ${id} AND "expiresAt" > NOW() AND "attempts" < 5 LIMIT 1`;
  const record = rows[0];
  if (!record) return { error: "OTP หมดอายุหรือใช้เกินจำนวนครั้ง" };
  await prisma.$executeRaw`UPDATE "CustomerPasswordResetOtp" SET "attempts" = "attempts" + 1 WHERE "id" = ${id}`;
  const auth = credentials();
  if (!auth) return { error: "ระบบ OTP ยังไม่พร้อมใช้งาน" };
  try {
    const response = await fetch("https://otp.thaibulksms.com/v2/otp/verify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key: auth.key, secret: auth.secret, token: record.providerToken, pin }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const data = await response.json().catch(() => null) as { status?: string } | null;
    if (!response.ok || data?.status !== "success") return { error: "OTP ไม่ถูกต้องหรือหมดอายุ" };
    await prisma.customer.update({
      where: { id: record.customerId },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        // การรีเซ็ตสำเร็จได้เพราะผ่าน SMS OTP ของเบอร์สมาชิกแล้ว
        phoneVerifiedAt: new Date(),
      },
    });
    await prisma.$executeRaw`DELETE FROM "CustomerPasswordResetOtp" WHERE "id" = ${id}`;
    (await cookies()).delete(COOKIE);
    return { reset: true };
  } catch { return { error: "ยืนยัน OTP ไม่สำเร็จ กรุณาลองใหม่" }; }
}
