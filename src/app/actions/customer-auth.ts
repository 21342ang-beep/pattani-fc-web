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
import { createOAuthState, getSafeReturnTo } from "@/lib/oauth";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/oauth-google";
import { buildLineAuthUrl, isLineConfigured } from "@/lib/oauth-line";

const registerSchema = z.object({
  name: z.string().trim().min(2, "กรอกชื่อ-นามสกุลให้ครบ").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("อีเมลไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{9,15}$/, "เบอร์โทรไม่ถูกต้อง"),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"], {
    message: "กรุณาเลือกเพศ",
  }),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันเกิด")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date <= new Date();
    }, "วันเกิดไม่ถูกต้อง"),
  address: z.string().trim().min(5, "กรุณากรอกที่อยู่").max(500),
  province: z.string().trim().min(1, "กรุณาเลือกจังหวัด"),
  district: z.string().trim().min(1, "กรุณาเลือกอำเภอ/เขต"),
  postalCode: z.string().regex(/^\d{5}$/, "กรุณาเลือกรหัสไปรษณีย์"),
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

  // mode = ปุ่มที่ลูกค้ากด: "password" (สมัครด้วยรหัสผ่าน) | "google" | "line"
  // ทุกโหมด validate ฟอร์มเต็มเหมือนกัน (บัญชี hybrid = มีรหัสผ่านเสมอ)
  const mode = String(formData.get("mode") ?? "password");
  const returnTo = getSafeReturnTo(formData.get("returnTo")?.toString());

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    gender: formData.get("gender"),
    birthDate: formData.get("birthDate"),
    address: formData.get("address"),
    province: formData.get("province"),
    district: formData.get("district"),
    postalCode: formData.get("postalCode"),
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

  const { name, email, phone, gender, birthDate, address, province, district, postalCode, password } = parsed.data;
  const accountEmail = email || `member-${crypto.randomUUID()}@accounts.pattanifc.local`;

  // ── โหมดผูก Google / LINE ──
  // validate ครบแล้ว → hash รหัสผ่าน, ฝากข้อมูลไว้ใน OAuth state (signed cookie),
  // แล้ว redirect ไป provider. บัญชีจะถูกสร้างตอน callback (ยึดอีเมล verified ของ provider)
  if (mode === "google" || mode === "line") {
    const provider = mode === "google" ? "GOOGLE" : "LINE";
    const configured =
      provider === "GOOGLE" ? isGoogleConfigured() : isLineConfigured();
    if (!configured) {
      return {
        error:
          provider === "GOOGLE"
            ? "ยังไม่ได้เปิดใช้การผูกบัญชี Google กรุณาสมัครด้วยรหัสผ่านก่อน"
            : "ยังไม่ได้เปิดใช้การผูกบัญชี LINE กรุณาสมัครด้วยรหัสผ่านก่อน",
      };
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const nonce = await createOAuthState(provider, "register", true, {
      name,
      email: email || "",
      phone: phone || null,
      gender,
      birthDate,
      address,
      province,
      district,
      postalCode,
      passwordHash,
    }, returnTo);
    const authUrl =
      provider === "GOOGLE"
        ? buildGoogleAuthUrl(nonce)
        : buildLineAuthUrl(nonce, nonce);
    redirect(authUrl); // absolute/external URL — server action ตอบ 303
  }

  // ── โหมดสมัครด้วยรหัสผ่าน (email/password) ──
  // กัน race: ตรวจซ้ำก่อน แล้ว create — error code P2002 จะกันได้อีกชั้น
  const existing = email ? await prisma.customer.findUnique({ where: { email } }) : null;
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
        email: accountEmail,
        passwordHash,
        name,
        phone: phone || null,
        gender,
        birthDate: new Date(`${birthDate}T00:00:00.000Z`),
        address,
        province,
        district,
        postalCode,
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

  redirect(returnTo ?? "/tickets/season");
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
