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
import { getPhoneChangeStepUp } from "@/lib/customer-profile-policy";
import { hasRetainedCustomerHistory } from "@/lib/customer-deletion-policy";

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
  currentPassword: z.string().max(200).optional().or(z.literal("")),
});

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const customer = await verifyCustomer();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || "",
    currentPassword: formData.get("currentPassword") || "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }

  const { name, phone, currentPassword } = parsed.data;
  const nextPhone = phone || null;
  const current = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: {
      id: true,
      email: true,
      phone: true,
      passwordHash: true,
      authVersion: true,
    },
  });
  if (!current || current.authVersion !== customer.authVersion) {
    await deleteCustomerSession();
    return { error: "ข้อมูลความปลอดภัยของบัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่" };
  }

  const stepUp = getPhoneChangeStepUp({
    currentPhone: current.phone,
    nextPhone,
    hasPassword: Boolean(current.passwordHash),
    currentPassword,
  });

  let nextAuthVersion = current.authVersion;
  if (stepUp !== "not-required") {
    // Limit both the source network and the account. This makes password
    // guessing ineffective even when an attacker rotates either dimension.
    const [ipLimit, accountLimit] = await Promise.all([
      rateLimit("profile_phone_change", {
        max: 5,
        windowMs: 15 * 60_000,
      }),
      rateLimit("profile_phone_change_customer", {
        max: 5,
        windowMs: 30 * 60_000,
        ip: current.id,
      }),
    ]);
    if (!ipLimit.ok || !accountLimit.ok) {
      return {
        error: `ยืนยันการเปลี่ยนเบอร์บ่อยเกินไป ลองใหม่ใน ${Math.max(
          ipLimit.retryAfterSec,
          accountLimit.retryAfterSec,
        )} วินาที`,
      };
    }
    if (stepUp === "blocked-social-only") {
      return {
        error: "ไม่สามารถเปลี่ยนเบอร์โทรได้",
        fieldErrors: {
          phone:
            "บัญชี Google/LINE ที่ยังไม่มีรหัสผ่านไม่สามารถเปลี่ยนเบอร์ด้วยตนเอง กรุณาตั้งรหัสผ่านผ่านการกู้บัญชีที่ยืนยันแล้วหรือติดต่อทีมงาน",
        },
      };
    }
    if (stepUp === "password-required") {
      return {
        error: "กรุณายืนยันรหัสผ่านปัจจุบัน",
        fieldErrors: { currentPassword: "กรุณากรอกรหัสผ่านปัจจุบัน" },
      };
    }
    if (
      stepUp !== "verify-password" ||
      typeof currentPassword !== "string" ||
      !current.passwordHash
    ) {
      return { error: "ไม่สามารถยืนยันการเปลี่ยนเบอร์ได้ กรุณาลองใหม่" };
    }

    const passwordOk = await bcrypt.compare(currentPassword, current.passwordHash);
    if (!passwordOk) {
      return {
        error: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
        fieldErrors: { currentPassword: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
      };
    }

    nextAuthVersion += 1;
    const result = await prisma.customer.updateMany({
      where: {
        id: current.id,
        authVersion: current.authVersion,
        passwordHash: current.passwordHash,
        phone: current.phone,
      },
      data: {
        name,
        phone: nextPhone,
        phoneVerifiedAt: null,
        authVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      await deleteCustomerSession();
      return { error: "ข้อมูลบัญชีเปลี่ยนระหว่างบันทึก กรุณาเข้าสู่ระบบใหม่" };
    }
  } else {
    // Do not write the submitted phone on a name-only save. Otherwise a stale
    // tab could restore an old phone without completing the step-up check.
    const result = await prisma.customer.updateMany({
      where: { id: current.id, authVersion: current.authVersion },
      data: { name },
    });
    if (result.count !== 1) {
      await deleteCustomerSession();
      return { error: "ข้อมูลบัญชีเปลี่ยนระหว่างบันทึก กรุณาเข้าสู่ระบบใหม่" };
    }
  }

  try {
    // Pin the replacement cookie to the security version authorized above.
    // If a password reset races this request, the new cookie is not issued.
    await createCustomerSession(
      current.id,
      current.email,
      name,
      nextAuthVersion,
    );
  } catch {
    await deleteCustomerSession();
    return {
      error:
        "บันทึกข้อมูลแล้ว แต่สถานะความปลอดภัยของบัญชีเปลี่ยน กรุณาเข้าสู่ระบบใหม่",
    };
  }

  revalidatePath("/member", "layout");
  return {
    success:
      stepUp === "not-required"
        ? "บันทึกโปรไฟล์เรียบร้อย"
        : "เปลี่ยนเบอร์แล้ว กรุณายืนยันเบอร์ใหม่ด้วย OTP ก่อนใช้เข้าสู่ระบบหรือกู้รหัสผ่าน",
  };
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
  if (!row.passwordHash) {
    return {
      error:
        "บัญชีนี้เข้าสู่ระบบด้วย Google/LINE จึงยังไม่มีรหัสผ่าน — ตั้งรหัสผ่านครั้งแรกได้ที่หน้าโปรไฟล์",
    };
  }
  const ok = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) {
    return {
      error: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
      fieldErrors: { currentPassword: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
    };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      passwordHash: newHash,
      authVersion: { increment: 1 },
      passwordResetOtps: { deleteMany: {} },
    },
    select: { id: true, email: true, name: true },
  });
  await createCustomerSession(updated.id, updated.email, updated.name);

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
    select: { passwordHash: true, authVersion: true },
  });
  if (!row) {
    return { error: "ไม่พบบัญชี" };
  }
  // A 30-day social session alone is not enough proof for irreversible
  // deletion. Social-only customers must establish a password first.
  if (!row.passwordHash) {
    return {
      error:
        "เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านในหน้าโปรไฟล์ก่อนลบบัญชี",
    };
  }
  const ok = await bcrypt.compare(parsed.data.password, row.passwordHash);
  if (!ok) {
    return {
      error: "รหัสผ่านไม่ถูกต้อง",
      fieldErrors: { password: "รหัสผ่านไม่ถูกต้อง" },
    };
  }

  // Lock and re-check the credential version before deleting. The legacy
  // season-pass customerId fields have no FK, so briefly block writes to every
  // retained-history table while count + delete run atomically.
  let outcome:
    | "not-found"
    | "security-changed"
    | "has-history"
    | "deleted";
  try {
    outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout TO '3s'`;
      await tx.$executeRaw`
        LOCK TABLE "Booking", "SeasonPassPurchase", "SeasonPassOrder"
        IN SHARE ROW EXCLUSIVE MODE
      `;
      const owners = await tx.$queryRaw<
        { id: string; passwordHash: string | null; authVersion: number }[]
      >`
        SELECT "id", "passwordHash", "authVersion" FROM "Customer"
        WHERE "id" = ${customer.id}
        FOR UPDATE
      `;
      const owner = owners[0];
      if (!owner) return "not-found" as const;
      if (
        owner.authVersion !== customer.authVersion ||
        owner.authVersion !== row.authVersion ||
        owner.passwordHash !== row.passwordHash
      ) {
        return "security-changed" as const;
      }

      const [bookings, seasonPassOrders, seasonPassPurchases] = await Promise.all([
        tx.booking.count({ where: { customerId: customer.id } }),
        tx.seasonPassOrder.count({ where: { customerId: customer.id } }),
        tx.seasonPassPurchase.count({ where: { customerId: customer.id } }),
      ]);
      if (
        hasRetainedCustomerHistory({
          bookings,
          seasonPassOrders,
          seasonPassPurchases,
        })
      ) {
        return "has-history" as const;
      }
      await tx.customer.delete({ where: { id: customer.id } });
      return "deleted" as const;
    });
  } catch {
    return {
      error:
        "ยังไม่สามารถตรวจสอบประวัติทั้งหมดได้ จึงยังไม่ลบบัญชี กรุณาลองใหม่ภายหลัง",
    };
  }
  if (outcome === "has-history") {
    return {
      error:
        "บัญชีนี้มีประวัติการจองหรือตั๋ว กรุณาติดต่อทีมงานเพื่อดำเนินการตามนโยบายเก็บรักษาข้อมูล",
    };
  }
  if (outcome !== "deleted") {
    await deleteCustomerSession();
    return {
      error:
        outcome === "not-found"
          ? "ไม่พบบัญชี"
          : "ข้อมูลความปลอดภัยของบัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่",
    };
  }

  await deleteCustomerSession();
  redirect("/");
}
