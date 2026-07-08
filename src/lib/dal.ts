import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Permission, Role } from "@prisma/client";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Data Access Layer — ตรวจ session ใกล้ data source ที่สุด
// ใช้ React cache เพื่อ memoize ภายใน render เดียว

export const verifySession = cache(async () => {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
});

export const verifyAdmin = cache(async () => {
  const session = await verifySession();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }
  return session;
});

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  permissions: Permission[];
};

// โหลด user จริงจาก DB — permissions เปลี่ยนแปลงตอนไหนก็มีผลทันที
// (ไม่แคชใน JWT เพื่อให้ SUPER_ADMIN ปรับสิทธิ์ได้ทันเวลา)
export const getAdminUser = cache(async (): Promise<AdminUser> => {
  const session = await verifyAdmin();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
    },
  });
  if (!user) redirect("/login");
  return user;
});

export function hasPermission(user: AdminUser, perm: Permission): boolean {
  return user.role === "SUPER_ADMIN" || user.permissions.includes(perm);
}

// Guard สำหรับหน้าย่อยแต่ละหมวด — ถ้าไม่มีสิทธิ์ ตี back ไปที่ dashboard
export async function verifyPermission(perm: Permission): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!hasPermission(user, perm)) redirect("/admin");
  return user;
}
