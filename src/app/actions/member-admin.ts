"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";

// ลบข้อมูลสมาชิก แต่เก็บประวัติการซื้อบัตรรายปีไว้และตัดการเชื่อมต่อกับบัญชีเดิม
export async function deleteMember(memberId: string): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("MEMBER_DATA");
  if (typeof memberId !== "string" || !/^[a-z0-9]+$/i.test(memberId)) {
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
