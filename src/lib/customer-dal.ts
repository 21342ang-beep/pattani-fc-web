import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readCustomerSession } from "@/lib/customer-session";

// Data Access Layer สำหรับ customer
// ตรวจ session ที่ data source อีกชั้น แล้วโหลด customer จริงจาก DB
// memoize ภายใน render เดียวด้วย React cache

export const verifyCustomer = cache(async () => {
  const session = await readCustomerSession();
  if (!session) redirect("/member/login");

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  // session ยังอยู่แต่ user โดนลบไปแล้ว → kick
  if (!customer) redirect("/member/login");
  return customer;
});
