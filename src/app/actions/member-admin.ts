"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";

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
  await verifyPermission("MEMBER_DATA");
  if (!validMemberId(memberId)) return { error: "รหัสสมาชิกไม่ถูกต้อง" };

  const parsed = updateMemberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
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

// ลบข้อมูลสมาชิก แต่เก็บประวัติการซื้อบัตรรายปีไว้และตัดการเชื่อมต่อกับบัญชีเดิม
export async function deleteMember(memberId: string): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("MEMBER_DATA");
  if (!validMemberId(memberId)) {
    return { error: "รหัสสมาชิกไม่ถูกต้อง" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.seasonPassOrder.updateMany({
        where: { customerId: memberId },
        data: { customerId: null },
      });
      await tx.customer.delete({ where: { id: memberId } });
    });
    revalidatePath("/admin/members");
    return { ok: true };
  } catch {
    return { error: "ลบข้อมูลสมาชิกไม่สำเร็จ" };
  }
}
