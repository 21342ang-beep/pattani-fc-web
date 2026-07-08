"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Permission, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { ALL_PERMISSIONS } from "@/lib/admin-sections";

// Server actions สำหรับหน้า /admin/users
// ทุก action ต้องเป็น SUPER_ADMIN เท่านั้น

async function requireSuperAdmin() {
  const session = await verifyAdmin();
  if (session.role !== "SUPER_ADMIN") redirect("/admin");
  return session;
}

const permissionEnum = z.enum(
  ALL_PERMISSIONS as unknown as [Permission, ...Permission[]],
);

const roleEnum = z.enum(["ADMIN", "SUPER_ADMIN"] as const);

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
  name: z.string().trim().max(100).optional(),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(200),
  role: roleEnum,
  permissions: z.array(permissionEnum).default([]),
});

const updateSchema = z.object({
  name: z.string().trim().max(100).optional(),
  role: roleEnum,
  permissions: z.array(permissionEnum).default([]),
});

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(200),
});

export type UserFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean }
  | undefined;

function readPermissions(formData: FormData): string[] {
  return formData.getAll("permissions").map(String).filter(Boolean);
}

// ── สร้างผู้ดูแลใหม่ ─────────────────────────────────────
export async function createAdmin(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireSuperAdmin();

  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    password: formData.get("password"),
    role: formData.get("role"),
    permissions: readPermissions(formData),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return { fieldErrors: { email: ["อีเมลนี้มีในระบบแล้ว"] } };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      passwordHash,
      role: parsed.data.role,
      permissions: parsed.data.permissions,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ── แก้ไข role + permissions ของผู้ดูแล ──────────────────
export async function updateAdmin(
  userId: string,
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireSuperAdmin();

  const parsed = updateSchema.safeParse({
    name: formData.get("name") || undefined,
    role: formData.get("role"),
    permissions: readPermissions(formData),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) return { error: "ไม่พบผู้ดูแลรายนี้" };

  // ห้ามลด role ของตัวเองจาก SUPER_ADMIN — กันตัวเองล็อกออก
  if (target.id === session.userId && parsed.data.role !== "SUPER_ADMIN") {
    return {
      error: "ห้ามลด role ของตัวเอง — ให้ SUPER_ADMIN คนอื่นทำแทน",
    };
  }

  // ถ้ากำลังจะลด role คนอื่นจาก SUPER_ADMIN → ต้องเหลือ SUPER_ADMIN อย่างน้อย 1 คน
  if (target.role === "SUPER_ADMIN" && parsed.data.role !== "SUPER_ADMIN") {
    const remaining = await prisma.user.count({
      where: { role: "SUPER_ADMIN", NOT: { id: target.id } },
    });
    if (remaining === 0) {
      return { error: "ต้องมี SUPER_ADMIN อย่างน้อย 1 คนในระบบ" };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name ?? null,
      role: parsed.data.role,
      permissions: parsed.data.permissions,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

// ── รีเซ็ตรหัสผ่านของผู้ดูแลรายอื่น ───────────────────────
export async function resetAdminPassword(
  userId: string,
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireSuperAdmin();

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) return { error: "ไม่พบผู้ดูแลรายนี้" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
  return { ok: true };
}

// ── ลบผู้ดูแล ────────────────────────────────────────────
export async function deleteAdmin(
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSuperAdmin();

  if (userId === session.userId) {
    return { error: "ห้ามลบตัวเอง" };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) return { error: "ไม่พบผู้ดูแลรายนี้" };

  if (target.role === "SUPER_ADMIN") {
    const remaining = await prisma.user.count({
      where: { role: "SUPER_ADMIN", NOT: { id: target.id } },
    });
    if (remaining === 0) {
      return { error: "ต้องมี SUPER_ADMIN อย่างน้อย 1 คนในระบบ" };
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}
