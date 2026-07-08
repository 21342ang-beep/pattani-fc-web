"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createCustomerSession,
  deleteCustomerSession,
} from "@/lib/customer-session";
import { rateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "กรอกชื่อ-นามสกุลให้ครบ").max(100),
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{9,15}$/, "เบอร์โทรไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร")
    .max(200, "รหัสผ่านยาวเกินไป")
    .regex(/[A-Za-z]/, "ต้องมีตัวอักษร")
    .regex(/[0-9]/, "ต้องมีตัวเลข"),
  confirmPassword: z.string(),
  pdpaConsent: z.literal("on", {
    message: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร",
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "รหัสผ่านยืนยันไม่ตรงกัน",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200),
});

export type CustomerAuthState =
  | { error?: string; fieldErrors?: Partial<Record<string, string>> }
  | undefined;

export async function registerCustomer(
  _prev: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  // กัน abuse: 5 ครั้ง / 10 นาที / IP
  const rl = await rateLimit("register", { max: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return {
      error: `สมัครสมาชิกบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    pdpaConsent: formData.get("pdpaConsent"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors };
  }

  const { name, email, phone, password } = parsed.data;

  // กัน race: ตรวจซ้ำก่อน แล้ว create — error code P2002 จะกันได้อีกชั้น
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "อีเมลนี้ถูกใช้งานแล้ว",
      fieldErrors: { email: "อีเมลนี้ถูกใช้งานแล้ว" },
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const customer = await prisma.customer.create({
      data: {
        email,
        passwordHash,
        name,
        phone: phone || null,
        pdpaConsentAt: new Date(),
      },
    });
    await createCustomerSession(customer.id, customer.email, customer.name);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return {
        error: "อีเมลนี้ถูกใช้งานแล้ว",
        fieldErrors: { email: "อีเมลนี้ถูกใช้งานแล้ว" },
      };
    }
    return { error: "เกิดข้อผิดพลาดในการสมัคร กรุณาลองใหม่อีกครั้ง" };
  }

  redirect("/member");
}

export async function loginCustomer(
  _prev: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  // กัน brute-force: 10 ครั้ง / 10 นาที / IP
  const rl = await rateLimit("customer_login", {
    max: 10,
    windowMs: 10 * 60_000,
  });
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

  const customer = await prisma.customer.findUnique({
    where: { email: parsed.data.email },
  });
  // เปรียบเทียบ password เสมอแม้ user ไม่มี เพื่อกัน timing attack
  const dummyHash = "$2b$12$QZJ/HRFVLd4HnZLjo8OBU.j8KD14Szu.WVM20ciuOHbEESySgkRN.";
  const ok = await bcrypt.compare(
    parsed.data.password,
    customer?.passwordHash ?? dummyHash,
  );

  if (!customer || !ok) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  // บัญชี social-only ไม่มีรหัสผ่าน → แจ้งให้ใช้ social login
  if (!customer.passwordHash) {
    return {
      error: "บัญชีนี้เข้าสู่ระบบด้วย Google/LINE — กรุณากดปุ่ม social ด้านบน",
    };
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });
  await createCustomerSession(customer.id, customer.email, customer.name);
  redirect("/member");
}

export async function logoutCustomer(): Promise<void> {
  await deleteCustomerSession();
  redirect("/");
}
