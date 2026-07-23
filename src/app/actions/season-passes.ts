"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAllProvinces } from "geothai";
import type { SeasonPassOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readCustomerSession } from "@/lib/customer-session";
import { verifyPermission } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import {
  SEASON_LABEL,
  SEASON_PASS_SHIPPING_FEE_BAHT,
  SEASON_TIERS,
} from "@/lib/season-pass-tiers";

// ─── Customer-facing: สร้างออเดอร์บัตรรายปี ─────────────────
// ยังใช้ mock payment gateway — บันทึกออเดอร์เป็น CONFIRMED ทันที
// TODO: เมื่อผูก payment provider จริง → CONFIRMED ต่อเมื่อ webhook ตอบสำเร็จ

const createSchema = z
  .object({
    tierId: z.enum(["vvip-elite", "vip-advanced", "premium", "gold"] as const),
    seatZone: z.enum(["VIP-A", "VIP-B", "PRIMIUM-A", "PRIMIUM-B", "PRIMIUM-E", "GOLD-D", "GOLD-F"] as const),
    name: z.string().trim().min(2, "กรุณากรอกชื่อ").max(100),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{9,15}$/, "เบอร์โทรไม่ถูกต้อง"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("รูปแบบอีเมลไม่ถูกต้อง")
      .max(200)
      .optional()
      .or(z.literal("")),
    paymentMethod: z.enum(["card", "promptpay", "banking"] as const),
    deliveryMethod: z.enum(["SHIPPING", "PICKUP"] as const),
    // shipping — required only if deliveryMethod=SHIPPING (refined below)
    shipAddress: z.string().trim().max(300).optional().or(z.literal("")),
    shipCity: z.string().trim().max(100).optional().or(z.literal("")),
    shipProvince: z.string().trim().max(100).optional().or(z.literal("")),
    shipPostalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นเลข 5 หลัก")
      .optional()
      .or(z.literal("")),
    shirtSize: z.enum(["S", "M", "L", "XL", "2XL", "3XL"] as const).optional().or(z.literal("")),
    shipNote: z.string().trim().max(300).optional().or(z.literal("")),
    // pickup — required only if deliveryMethod=PICKUP
    pickupLocation: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    if (d.deliveryMethod === "SHIPPING") {
      if (!d.shipAddress)
        ctx.addIssue({
          code: "custom",
          path: ["shipAddress"],
          message: "กรุณากรอกที่อยู่",
        });
      if (!d.shipCity)
        ctx.addIssue({
          code: "custom",
          path: ["shipCity"],
          message: "กรุณากรอกอำเภอ/เขต",
        });
      if (!d.shipProvince)
        ctx.addIssue({
          code: "custom",
          path: ["shipProvince"],
          message: "กรุณากรอกจังหวัด",
        });
      if (!d.shipPostalCode)
        ctx.addIssue({
          code: "custom",
          path: ["shipPostalCode"],
          message: "กรุณากรอกรหัสไปรษณีย์",
        });
      if (!d.shirtSize)
        ctx.addIssue({
          code: "custom",
          path: ["shirtSize"],
          message: "กรุณาเลือกไซส์เสื้อ",
        });
    } else if (d.deliveryMethod === "PICKUP") {
      if (!d.pickupLocation)
        ctx.addIssue({
          code: "custom",
          path: ["pickupLocation"],
          message: "กรุณาเลือกจุดรับบัตร",
        });
    }
  });

export type CreateSeasonPassResult =
  | { ok: true; passCode: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createSeasonPassOrder(
  input: z.input<typeof createSchema>,
): Promise<CreateSeasonPassResult> {
  // กัน abuse — สมัคร spam ไม่เกิน 5 ครั้ง / 10 นาที / IP
  const rl = await rateLimit("season_pass_create", {
    max: 5,
    windowMs: 10 * 60_000,
  });
  if (!rl.ok) {
    return {
      ok: false,
      error: `ทำรายการบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }

  if (parsed.data.deliveryMethod === "SHIPPING") {
    const province = getAllProvinces().find(
      (item) => item.name_th === parsed.data.shipProvince,
    );
    const district = province?.districts.find(
      (item) => item.name_th === parsed.data.shipCity,
    );
    const postalCodes = new Set(
      district?.subdistricts.map((item) => String(item.postal_code)) ?? [],
    );
    if (!province || !district || !postalCodes.has(parsed.data.shipPostalCode ?? "")) {
      return { ok: false, error: "กรุณาเลือกจังหวัด อำเภอ และรหัสไปรษณีย์จากรายการ" };
    }
  }

  const tier = SEASON_TIERS.find((t) => t.id === parsed.data.tierId);
  if (!tier) return { ok: false, error: "ไม่พบระดับบัตรที่เลือก" };

  const session = await readCustomerSession();
  const email = parsed.data.email || session?.email || null;
  const shippingFeeBaht =
    parsed.data.deliveryMethod === "SHIPPING"
      ? SEASON_PASS_SHIPPING_FEE_BAHT
      : 0;

  try {
    const order = await prisma.$transaction(async (tx) => {
      const barcode = await tx.seasonPassBarcode.findFirst({
        where: {
          tierId: parsed.data.tierId,
          orderId: null,
          isGenerated: true,
        },
        orderBy: { barcode: "asc" },
        select: { id: true, barcode: true },
      });
      if (!barcode) throw new Error("SOLD_OUT");
      const created = await tx.seasonPassOrder.create({
      data: {
        passCode: barcode.barcode,
        tierId: parsed.data.tierId,
        seatZone: parsed.data.seatZone,
        seasonLabel: SEASON_LABEL,
        priceBaht: tier.priceBaht,
        shippingFeeBaht,
        customerId: session?.customerId ?? null,
        customerName: parsed.data.name,
        customerPhone: parsed.data.phone,
        customerEmail: email,
        deliveryMethod: parsed.data.deliveryMethod,
        shipAddress: parsed.data.shipAddress || null,
        shipCity: parsed.data.shipCity || null,
        shipProvince: parsed.data.shipProvince || null,
        shipPostalCode: parsed.data.shipPostalCode || null,
        shirtSize: parsed.data.shirtSize || null,
        shipNote: parsed.data.shipNote || null,
        pickupLocation: parsed.data.pickupLocation || null,
        paymentMethod: parsed.data.paymentMethod,
        status: "CONFIRMED",
      },
      });
      const claimed = await tx.seasonPassBarcode.updateMany({
        where: { id: barcode.id, orderId: null, isGenerated: true },
        data: { orderId: created.id, assignedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("SOLD_OUT");
      return created;
    });
    revalidatePath("/admin/season-passes");
    return { ok: true, passCode: order.passCode };
  } catch (error) {
    if (error instanceof Error && error.message === "SOLD_OUT") {
      return { ok: false, error: "บัตรประเภทนี้จำหน่ายหมดแล้ว" };
    }
    return { ok: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }
}

// สร้าง passCode รูปแบบ SP-<TIER>-<8 chars> (ตัวอักษรอ่านง่าย)
// ─── Admin: เปลี่ยนสถานะออเดอร์ ─────────────────────────────
const statusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "REFUNDED",
] as const);

export async function updateSeasonPassStatus(
  orderId: string,
  status: SeasonPassOrderStatus,
): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("SEASON_PASSES");
  if (!statusEnum.safeParse(status).success) {
    return { error: "สถานะไม่ถูกต้อง" };
  }
  try {
    await prisma.seasonPassOrder.update({
      where: { id: orderId },
      data: { status },
    });
    revalidatePath("/admin/season-passes");
    return { ok: true };
  } catch {
    return { error: "อัปเดตไม่สำเร็จ" };
  }
}

export async function deleteSeasonPassOrder(
  orderId: string,
): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("SEASON_PASSES");
  if (typeof orderId !== "string" || !/^[a-z0-9]+$/i.test(orderId)) {
    return { error: "รหัสไม่ถูกต้อง" };
  }
  try {
    await prisma.seasonPassOrder.delete({ where: { id: orderId } });
    revalidatePath("/admin/season-passes");
    return { ok: true };
  } catch {
    return { error: "ลบไม่สำเร็จ" };
  }
}
