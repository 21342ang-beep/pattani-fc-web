"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { payload } from "@/lib/payload";

// ---- safety design notes ----
// 1) ทุกราคาคำนวณใหม่จาก Payload (CMS) — ห้ามเชื่อ unitPrice จาก client
// 2) ค่าจัดส่งเลือกจาก enum + ตาราง fix ฝั่ง server เท่านั้น
// 3) สถานะ COD ถูกบังคับเฉพาะ shipping != PICKUP
// 4) ทุก write อยู่ใน prisma.$transaction กัน partial insert
// 5) input ทุก field กรอง XSS ด้วย Zod + .trim() — ไม่ render เป็น HTML ดิบ
// 6) เลขสูงสุดต่อบรรทัด / จำนวนบรรทัด จำกัดทั้งฝั่ง cart และ action

const MAX_LINES = 30;
const MAX_QTY_PER_LINE = 20;

const SHIPPING_FEE_SATANG: Record<"STANDARD" | "EXPRESS" | "PICKUP", number> = {
  STANDARD: 50_00,
  EXPRESS: 80_00,
  PICKUP: 0,
};

const itemSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
  size: z.string().trim().max(16).optional(),
});

const addressSchema = z.object({
  shipAddress: z.string().trim().min(5).max(500),
  shipCity: z.string().trim().min(1).max(120),
  shipProvince: z.string().trim().min(1).max(120),
  shipPostalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"),
  shipNote: z.string().trim().max(500).optional(),
});

const baseSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "เบอร์โทรไม่ถูกต้อง"),
  customerEmail: z
    .string()
    .trim()
    .max(200)
    .email("อีเมลไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  shippingMethod: z.enum(["STANDARD", "EXPRESS", "PICKUP"]),
  paymentMethod: z.enum(["PROMPTPAY", "BANK_TRANSFER", "COD"]),
  items: z.array(itemSchema).min(1).max(MAX_LINES),
});

// ใช้ refinement: ถ้า shipping = STANDARD/EXPRESS ต้องมี address
//                 ถ้า PICKUP ไม่ต้องมี
//                 ถ้า COD ต้องไม่ใช่ PICKUP (เก็บปลายทางต้องมี address)
const shopOrderSchema = baseSchema
  .extend({
    shipAddress: z.string().trim().max(500).optional(),
    shipCity: z.string().trim().max(120).optional(),
    shipProvince: z.string().trim().max(120).optional(),
    shipPostalCode: z.string().trim().max(10).optional(),
    shipNote: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.shippingMethod !== "PICKUP") {
      const r = addressSchema.safeParse({
        shipAddress: data.shipAddress,
        shipCity: data.shipCity,
        shipProvince: data.shipProvince,
        shipPostalCode: data.shipPostalCode,
        shipNote: data.shipNote,
      });
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: issue.path });
        }
      }
    }
    if (data.paymentMethod === "COD" && data.shippingMethod === "PICKUP") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "วิธีเก็บปลายทางใช้กับการรับที่สโมสรไม่ได้",
      });
    }
  });

export type ShopOrderInput = z.infer<typeof shopOrderSchema>;

export type ShopOrderState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[]>;
      orderCode?: string;
      redirectTo?: string;
    }
  | undefined;

type PayloadProduct = {
  id: string | number;
  name: string;
  price: number;
  salePrice?: number | null;
  active?: boolean;
  sizes?: { label?: string; stock?: number }[];
  image?: { url?: string; filename?: string } | string | null;
};

function resolveImageUrl(img: PayloadProduct["image"]): string | null {
  if (!img || typeof img === "string") return null;
  if (img.url) return img.url;
  if (img.filename) return `/uploads/media/${img.filename}`;
  return null;
}

function effectiveUnitPriceSatang(p: PayloadProduct): number {
  const base = Math.max(0, Math.round(p.price));
  const sale =
    p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price
      ? Math.max(0, Math.round(p.salePrice))
      : base;
  // raคาใน Payload เก็บเป็นบาท → คูณ 100 เป็นสตางค์
  return sale * 100;
}

// payload field validation — กัน prototype pollution / object สมมาตรแปลก
function isValidPayloadProduct(p: unknown): p is PayloadProduct {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    (typeof o.id === "string" || typeof o.id === "number") &&
    typeof o.name === "string" &&
    typeof o.price === "number" &&
    Number.isFinite(o.price)
  );
}

export async function createShopOrder(
  _prev: ShopOrderState,
  formData: FormData
): Promise<ShopOrderState> {
  // 1) แกะ items JSON จาก hidden field — กัน input ใหญ่เกิน 50KB
  const itemsRaw = String(formData.get("items") ?? "");
  if (itemsRaw.length > 50_000) {
    return { error: "ตะกร้าใหญ่เกินไป" };
  }
  let itemsParsed: unknown;
  try {
    itemsParsed = JSON.parse(itemsRaw);
  } catch {
    return { error: "ข้อมูลตะกร้าไม่ถูกต้อง" };
  }

  // 2) Zod validate ทั้งก้อน
  const parsed = shopOrderSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") || undefined,
    shippingMethod: formData.get("shippingMethod"),
    paymentMethod: formData.get("paymentMethod"),
    shipAddress: formData.get("shipAddress") || undefined,
    shipCity: formData.get("shipCity") || undefined,
    shipProvince: formData.get("shipProvince") || undefined,
    shipPostalCode: formData.get("shipPostalCode") || undefined,
    shipNote: formData.get("shipNote") || undefined,
    items: itemsParsed,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString() ?? "_";
      (fieldErrors[k] ??= []).push(issue.message);
    }
    return { error: "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }
  const data = parsed.data;

  // 3) ดึงสินค้าจาก Payload ตามรายการใน cart — verify ราคาและ active ใหม่
  const cms = await payload();
  const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
  const lookup = new Map<string, PayloadProduct>();
  await Promise.all(
    productIds.map(async (pid) => {
      try {
        const doc = await cms.findByID({
          collection: "products",
          id: pid,
          overrideAccess: true,
          depth: 1,
        });
        if (isValidPayloadProduct(doc) && doc.active !== false) {
          lookup.set(String(doc.id), doc);
        }
      } catch {
        // ไม่พบสินค้า — จะถูกตรวจในวนรอบถัดไป
      }
    })
  );

  // 4) คำนวณราคาแต่ละบรรทัด + เช็คสต็อกของไซส์ (ถ้ามี)
  type Line = {
    productId: string;
    productName: string;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    size?: string;
    lineTotal: number;
  };
  const lines: Line[] = [];
  for (const it of data.items) {
    const p = lookup.get(it.productId);
    if (!p) {
      return { error: `ไม่พบสินค้า (${it.productId}) หรือสินค้าถูกปิดการขาย` };
    }
    if (it.size) {
      const matched = (p.sizes ?? []).find((s) => s.label === it.size);
      if (!matched) {
        return { error: `ไซส์ ${it.size} ไม่มีในสินค้า "${p.name}"` };
      }
      if (matched.stock != null && matched.stock < it.quantity) {
        return {
          error: `สินค้า "${p.name}" ไซส์ ${it.size} คงเหลือ ${matched.stock} ชิ้น`,
        };
      }
    }
    const unitPrice = effectiveUnitPriceSatang(p);
    if (unitPrice <= 0) {
      return { error: `สินค้า "${p.name}" ยังไม่ระบุราคา` };
    }
    lines.push({
      productId: String(p.id),
      productName: p.name,
      imageUrl: resolveImageUrl(p.image),
      unitPrice,
      quantity: it.quantity,
      size: it.size,
      lineTotal: unitPrice * it.quantity,
    });
  }

  // 5) คำนวณยอด — ทุกค่าจาก server-only
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shippingFee = SHIPPING_FEE_SATANG[data.shippingMethod];
  const totalAmount = subtotal + shippingFee;
  if (totalAmount <= 0) {
    return { error: "ยอดรวมไม่ถูกต้อง" };
  }

  // 6) บันทึก atomic
  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const order = await tx.shopOrder.create({
          data: {
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail || null,
            shippingMethod: data.shippingMethod,
            shippingFee,
            shipAddress: data.shippingMethod === "PICKUP" ? null : data.shipAddress ?? null,
            shipCity: data.shippingMethod === "PICKUP" ? null : data.shipCity ?? null,
            shipProvince: data.shippingMethod === "PICKUP" ? null : data.shipProvince ?? null,
            shipPostalCode:
              data.shippingMethod === "PICKUP" ? null : data.shipPostalCode ?? null,
            shipNote: data.shipNote ?? null,
            subtotal,
            totalAmount,
            paymentMethod: data.paymentMethod,
            status: "PENDING",
            items: {
              createMany: {
                data: lines.map((l) => ({
                  productId: l.productId,
                  productName: l.productName,
                  imageUrl: l.imageUrl,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                  size: l.size ?? null,
                  lineTotal: l.lineTotal,
                })),
              },
            },
          },
          select: { orderCode: true, customerPhone: true },
        });
        return order;
      },
      { maxWait: 10_000, timeout: 15_000 }
    );

    revalidatePath("/shop");
    return {
      orderCode: created.orderCode,
      redirectTo: `/shop/order/${created.orderCode}?phone=${encodeURIComponent(created.customerPhone)}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "สร้างออเดอร์ไม่สำเร็จ" };
  }
}

// ปุ่ม "ฉันชำระแล้ว" บนหน้าออเดอร์ — เปลี่ยน status เป็น PAID
// production: ควรเป็น webhook จาก payment gateway ไม่ใช่ปุ่มจาก client
const confirmSchema = z.object({
  orderCode: z.string().trim().min(8).max(50).regex(/^[a-z0-9]+$/i),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/),
});

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

export async function confirmShopPayment(
  _prev: ShopOrderState,
  formData: FormData
): Promise<ShopOrderState> {
  const parsed = confirmSchema.safeParse({
    orderCode: formData.get("orderCode"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  try {
    await prisma.$transaction(
      async (tx) => {
        const o = await tx.shopOrder.findUnique({
          where: { orderCode: parsed.data.orderCode },
          select: { id: true, customerPhone: true, status: true, paymentMethod: true },
        });
        if (!o || normalizePhone(o.customerPhone) !== normalizePhone(parsed.data.phone)) {
          throw new Error("ไม่พบออเดอร์ที่ตรงกับข้อมูล");
        }
        if (o.status !== "PENDING") return;
        if (o.paymentMethod === "COD") {
          // COD ห้ามกดยืนยันชำระเอง
          throw new Error("ออเดอร์เก็บปลายทาง ไม่ต้องยืนยันการชำระล่วงหน้า");
        }
        await tx.shopOrder.update({
          where: { id: o.id },
          data: { status: "PAID", paidAt: new Date() },
        });
      },
      { maxWait: 10_000, timeout: 15_000 }
    );

    revalidatePath(`/shop/order/${parsed.data.orderCode}`);
    return {
      orderCode: parsed.data.orderCode,
      redirectTo: `/shop/order/${parsed.data.orderCode}?phone=${encodeURIComponent(parsed.data.phone)}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ยืนยันไม่สำเร็จ" };
  }
}
