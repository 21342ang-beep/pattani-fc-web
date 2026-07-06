"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyCustomer } from "@/lib/customer-dal";
import {
  createCustomerSession,
  deleteCustomerSession,
} from "@/lib/customer-session";
import { rateLimit } from "@/lib/rate-limit";

export type ProfileState =
  | { error?: string; success?: string; fieldErrors?: Record<string, string> }
  | undefined;

const profileSchema = z.object({
  name: z.string().trim().min(2, "กรอกชื่อ-นามสกุลให้ครบ").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{9,15}$/, "เบอร์โทรไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
});

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const customer = await verifyCustomer();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }

  const { name, phone } = parsed.data;
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { name, phone: phone || null },
  });

  // ชื่อเปลี่ยน → refresh session token ให้ avatar/nav แสดงชื่อใหม่
  await createCustomerSession(updated.id, updated.email, updated.name);

  revalidatePath("/member", "layout");
  return { success: "บันทึกโปรไฟล์เรียบร้อย" };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z
      .string()
      .min(8, "รหัสผ่านใหม่ต้องอย่างน้อย 8 ตัวอักษร")
      .max(200)
      .regex(/[A-Za-z]/, "ต้องมีตัวอักษร")
      .regex(/[0-9]/, "ต้องมีตัวเลข"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "รหัสผ่านยืนยันไม่ตรงกัน",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "รหัสผ่านใหม่ต้องต่างจากรหัสปัจจุบัน",
    path: ["newPassword"],
  });

export async function changePassword(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const customer = await verifyCustomer();

  // กัน brute-force currentPassword: 5 ครั้ง / 15 นาที / IP
  const rl = await rateLimit("change_password", {
    max: 5,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    return {
      error: `ทำรายการบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }

  // ต้องเช็ค current password อีกชั้น
  const row = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: { passwordHash: true },
  });
  if (!row) {
    return { error: "ไม่พบบัญชี" };
  }
  const ok = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) {
    return {
      error: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
      fieldErrors: { currentPassword: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
    };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: newHash },
  });

  return { success: "เปลี่ยนรหัสผ่านเรียบร้อย" };
}

const deleteSchema = z.object({
  // ต้องพิมพ์ "DELETE" ยืนยัน + ใส่ password
  confirm: z.literal("DELETE", { message: 'พิมพ์ "DELETE" เพื่อยืนยัน' }),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export async function deleteAccount(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const customer = await verifyCustomer();

  const rl = await rateLimit("delete_account", {
    max: 3,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return {
      error: `ทำรายการบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  const parsed = deleteSchema.safeParse({
    confirm: formData.get("confirm"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "ข้อมูลยืนยันไม่ถูกต้อง", fieldErrors };
  }

  const row = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: { passwordHash: true },
  });
  if (!row) {
    return { error: "ไม่พบบัญชี" };
  }
  const ok = await bcrypt.compare(parsed.data.password, row.passwordHash);
  if (!ok) {
    return {
      error: "รหัสผ่านไม่ถูกต้อง",
      fieldErrors: { password: "รหัสผ่านไม่ถูกต้อง" },
    };
  }

  await prisma.customer.delete({ where: { id: customer.id } });
  await deleteCustomerSession();
  redirect("/");
}
