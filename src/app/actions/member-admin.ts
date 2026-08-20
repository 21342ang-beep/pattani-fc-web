"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPermission, verifySuperAdmin } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import { hasRetainedCustomerHistory } from "@/lib/customer-deletion-policy";

const updateMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "กรุณากรอกชื่อ-นามสกุลให้ครบ")
    .max(100, "ชื่อ-นามสกุลยาวเกินไป"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("อีเมลไม่ถูกต้อง")
    .max(200, "อีเมลยาวเกินไป"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{9,20}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง")
    .or(z.literal("")),
  password: z
    .string()
    .max(200, "รหัสผ่านยาวเกินไป")
    .refine((value) => value === "" || value.length >= 8, {
      message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
    }),
  confirmPassword: z.string().max(200, "รหัสผ่านยาวเกินไป"),
  adminPassword: z.string().max(200, "รหัสผ่านผู้ดูแลยาวเกินไป"),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "ยืนยันรหัสผ่านไม่ตรงกัน",
});

export type MemberFormState =
  | {
      ok?: boolean;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    }
  | undefined;

function validMemberId(memberId: string) {
  return typeof memberId === "string" && /^[a-z0-9]+$/i.test(memberId);
}

export async function updateMember(
  memberId: string,
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const actor = await verifyPermission("MEMBER_DATA");
  if (!validMemberId(memberId)) return { error: "รหัสสมาชิกไม่ถูกต้อง" };

  const parsed = updateMemberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.password && actor.role !== "SUPER_ADMIN") {
    return {
      fieldErrors: {
        password: ["เฉพาะผู้ดูแลสูงสุดเท่านั้นที่ตั้งรหัสผ่านใหม่ให้สมาชิกได้"],
      },
    };
  }
  if (parsed.data.password) {
    if (!parsed.data.adminPassword) {
      return {
        fieldErrors: {
          adminPassword: ["กรอกรหัสผ่านปัจจุบันของผู้ดูแลเพื่อยืนยัน"],
        },
      };
    }
    const stepUpLimit = await rateLimit("member_admin_password_stepup", {
      max: 5,
      windowMs: 15 * 60_000,
      ip: actor.id,
    });
    if (!stepUpLimit.ok) {
      return { error: "ยืนยันสิทธิ์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" };
    }
    const adminCredential = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { passwordHash: true },
    });
    const validAdminPassword = await bcrypt.compare(
      parsed.data.adminPassword,
      adminCredential?.passwordHash ??
        "$2b$12$QZJ/HRFVLd4HnZLjo8OBU.j8KD14Szu.WVM20ciuOHbEESySgkRN.",
    );
    if (!validAdminPassword) {
      return {
        fieldErrors: {
          adminPassword: ["รหัสผ่านผู้ดูแลไม่ถูกต้อง"],
        },
      };
    }
  }

  const current = await prisma.customer.findUnique({
    where: { id: memberId },
    select: { id: true, email: true, phone: true },
  });
  if (!current) return { error: "ไม่พบสมาชิกบัญชีนี้" };

  const existingEmail = await prisma.customer.findFirst({
    where: { email: parsed.data.email, NOT: { id: memberId } },
    select: { id: true },
  });
  if (existingEmail) {
    return { fieldErrors: { email: ["อีเมลนี้มีบัญชีสมาชิกใช้งานแล้ว"] } };
  }

  const phone = parsed.data.phone || null;
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const duplicatePhone = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Customer"
      WHERE id <> ${memberId}
        AND regexp_replace(coalesce("phone", ''), '\\D', '', 'g') = ${digits}
      LIMIT 1
    `;
    if (duplicatePhone.length > 0) {
      return { fieldErrors: { phone: ["เบอร์โทรศัพท์นี้มีบัญชีสมาชิกใช้งานแล้ว"] } };
    }
  }

  const emailChanged = current.email.toLowerCase() !== parsed.data.email;
  const phoneChanged = (current.phone ?? "") !== (phone ?? "");
  const passwordHash = parsed.data.password
    ? await bcrypt.hash(parsed.data.password, 12)
    : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: memberId },
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone,
          passwordHash,
          authVersion:
            passwordHash || emailChanged || phoneChanged
              ? { increment: 1 }
              : undefined,
          emailVerifiedAt: emailChanged ? null : undefined,
          phoneVerifiedAt: phoneChanged ? null : undefined,
        },
      });
      if (passwordHash) {
        await tx.customerPasswordResetOtp.deleteMany({ where: { customerId: memberId } });
      }
    });
  } catch {
    return { error: "บันทึกข้อมูลสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}/edit`);
  return { ok: true };
}

// Hard-delete is reserved for unused accounts. Unlinking retained records would
// let a future account with the same email/phone claim the old tickets.
export async function deleteMember(memberId: string): Promise<{ ok: true } | { error: string }> {
  await verifySuperAdmin();
  if (!validMemberId(memberId)) {
    return { error: "รหัสสมาชิกไม่ถูกต้อง" };
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Season-pass customerId fields are legacy strings without a foreign
      // key, so an owner-row lock alone cannot stop a concurrent association.
      // This brief write lock makes count + delete atomic across every retained
      // history table. It never blocks read-only sales/admin pages.
      await tx.$executeRaw`SET LOCAL lock_timeout TO '3s'`;
      await tx.$executeRaw`
        LOCK TABLE "Booking", "SeasonPassPurchase", "SeasonPassOrder"
        IN SHARE ROW EXCLUSIVE MODE
      `;
      const owner = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Customer"
        WHERE "id" = ${memberId}
        FOR UPDATE
      `;
      if (!owner[0]) return "not-found" as const;

      const [bookings, seasonPassPurchases, seasonPassOrders] = await Promise.all([
        tx.booking.count({ where: { customerId: memberId } }),
        tx.seasonPassPurchase.count({ where: { customerId: memberId } }),
        tx.seasonPassOrder.count({ where: { customerId: memberId } }),
      ]);
      if (
        hasRetainedCustomerHistory({
          bookings,
          seasonPassPurchases,
          seasonPassOrders,
        })
      ) {
        return "has-history" as const;
      }

      await tx.customer.delete({ where: { id: memberId } });
      return "deleted" as const;
    });
    if (outcome === "not-found") return { error: "ไม่พบสมาชิกบัญชีนี้" };
    if (outcome === "has-history") {
      return {
        error:
          "ลบบัญชีนี้ไม่ได้ เนื่องจากมีประวัติการจองหรือตั๋วอยู่ กรุณาเก็บบัญชีไว้เพื่อป้องกันผู้อื่นอ้างสิทธิ์รายการเดิม",
      };
    }
    revalidatePath("/admin/members");
    return { ok: true };
  } catch {
    return { error: "ลบข้อมูลสมาชิกไม่สำเร็จ" };
  }
}
