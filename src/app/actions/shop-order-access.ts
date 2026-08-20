"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  createShopOrderAccessToken,
  SHOP_ORDER_ACCESS_COOKIE,
} from "@/lib/shop-order-access";

export type ShopOrderAccessState = { error?: string } | undefined;

const schema = z.object({
  code: z.string().trim().regex(/^[a-z0-9]{10,50}$/i),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{9,20}$/),
});

function normalizedPhone(value: string): string {
  return value.replace(/\D/g, "").replace(/^66(?=\d{9}$)/, "0");
}

function phoneMatches(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(normalizedPhone(left)).digest();
  const rightHash = createHash("sha256").update(normalizedPhone(right)).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function grantShopOrderAccess(
  _previous: ShopOrderAccessState,
  formData: FormData,
): Promise<ShopOrderAccessState> {
  const ipLimit = await rateLimit("shop_order_access", {
    max: 10,
    windowMs: 15 * 60_000,
  });
  if (!ipLimit.ok) return { error: "ลองบ่อยเกินไป กรุณารอสักครู่" };

  const parsed = schema.safeParse({
    code: formData.get("code"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: "ไม่พบคำสั่งซื้อหรือข้อมูลไม่ถูกต้อง" };

  const orderLimit = await rateLimit("shop_order_access_order", {
    max: 5,
    windowMs: 30 * 60_000,
    ip: parsed.data.code,
  });
  if (!orderLimit.ok) return { error: "ลองบ่อยเกินไป กรุณารอสักครู่" };

  const order = await prisma.shopOrder.findUnique({
    where: { orderCode: parsed.data.code },
    select: { orderCode: true, customerPhone: true },
  });
  if (!order || !phoneMatches(order.customerPhone, parsed.data.phone)) {
    return { error: "ไม่พบคำสั่งซื้อหรือข้อมูลไม่ถูกต้อง" };
  }

  const token = await createShopOrderAccessToken(order.orderCode);
  (await cookies()).set(SHOP_ORDER_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/shop/order",
    maxAge: 24 * 60 * 60,
  });
  redirect(`/shop/order/${order.orderCode}`);
}
