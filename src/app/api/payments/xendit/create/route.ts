import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPromptPayPaymentRequest } from "@/lib/xendit";

const bodySchema = z.object({
  bookingCode: z.string().trim().min(8).max(50).regex(/^[a-z0-9]+$/i).optional(),
  seasonPassCode: z.string().trim().min(8).max(100).regex(/^[a-z0-9-]+$/i).optional(),
}).refine((value) => Boolean(value.bookingCode) !== Boolean(value.seasonPassCode), {
  message: "Provide exactly one payment target",
});

async function toQrSvg(qrString: string) {
  return QRCode.toString(qrString, {
    type: "svg",
    margin: 1,
    width: 320,
    color: { dark: "#052e1b", light: "#ffffff" },
  });
}

async function pendingQr(where: Prisma.Sql) {
  return prisma.$queryRaw<Array<{ paymentRequestId: string; qrString: string | null }>>(
    Prisma.sql`SELECT "paymentRequestId", "qrString" FROM "XenditPayment" ${where}
      AND "status" = 'PENDING' AND "qrString" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1`,
  );
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, { status: 400 });
  return parsed.data.seasonPassCode
    ? createSeasonPassPayment(parsed.data.seasonPassCode)
    : createBookingPayment(parsed.data.bookingCode!);
}

async function createBookingPayment(bookingCode: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingCode },
    select: { id: true, bookingCode: true, totalAmount: true, status: true },
  });
  if (!booking) return Response.json({ error: "ไม่พบรายการจอง" }, { status: 404 });
  if (booking.status !== "PENDING") return Response.json({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });

  const existing = await pendingQr(Prisma.sql`WHERE "bookingId" = ${booking.id}`);
  if (existing[0]?.qrString) return Response.json({ paymentRequestId: existing[0].paymentRequestId, qrSvg: await toQrSvg(existing[0].qrString) });

  try {
    const referenceId = `booking_${booking.bookingCode}_${randomUUID().replace(/-/g, "")}`;
    const created = await createPromptPayPaymentRequest({ referenceId, amountBaht: booking.totalAmount / 100, description: `Pattani FC ticket ${booking.bookingCode}` });
    await prisma.$executeRaw(Prisma.sql`INSERT INTO "XenditPayment"
      ("id", "bookingId", "referenceId", "paymentRequestId", "amount", "status", "qrString", "updatedAt")
      VALUES (${randomUUID()}, ${booking.id}, ${referenceId}, ${created.paymentRequestId}, ${booking.totalAmount}, 'PENDING', ${created.qrString}, NOW())`);
    return Response.json({ paymentRequestId: created.paymentRequestId, qrSvg: await toQrSvg(created.qrString) });
  } catch (error) {
    return handleCreateError(error, Prisma.sql`WHERE "bookingId" = ${booking.id}`);
  }
}

async function createSeasonPassPayment(seasonPassCode: string) {
  const purchase = await prisma.seasonPassPurchase.findUnique({
    where: { purchaseCode: seasonPassCode },
    select: { id: true, purchaseCode: true, totalBaht: true, status: true },
  });
  if (purchase) {
    if (purchase.status !== "PENDING") {
      return Response.json({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });
    }
    const existing = await pendingQr(Prisma.sql`WHERE "seasonPassPurchaseId" = ${purchase.id}`);
    if (existing[0]?.qrString) {
      return Response.json({ paymentRequestId: existing[0].paymentRequestId, qrSvg: await toQrSvg(existing[0].qrString) });
    }
    const amount = purchase.totalBaht * 100;
    try {
      const referenceId = `season_${purchase.purchaseCode}_${randomUUID().replace(/-/g, "")}`;
      const created = await createPromptPayPaymentRequest({ referenceId, amountBaht: amount / 100, description: `Pattani FC season passes ${purchase.purchaseCode}` });
      await prisma.$executeRaw(Prisma.sql`INSERT INTO "XenditPayment"
        ("id", "seasonPassPurchaseId", "referenceId", "paymentRequestId", "amount", "status", "qrString", "updatedAt")
        VALUES (${randomUUID()}, ${purchase.id}, ${referenceId}, ${created.paymentRequestId}, ${amount}, 'PENDING', ${created.qrString}, NOW())`);
      return Response.json({ paymentRequestId: created.paymentRequestId, qrSvg: await toQrSvg(created.qrString) });
    } catch (error) {
      return handleCreateError(error, Prisma.sql`WHERE "seasonPassPurchaseId" = ${purchase.id}`);
    }
  }

  const order = await prisma.seasonPassOrder.findUnique({
    where: { passCode: seasonPassCode },
    select: { id: true, passCode: true, priceBaht: true, shippingFeeBaht: true, status: true },
  });
  if (!order) return Response.json({ error: "ไม่พบรายการสมัครบัตรรายปี" }, { status: 404 });
  if (order.status !== "PENDING") return Response.json({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });

  const existing = await pendingQr(Prisma.sql`WHERE "seasonPassOrderId" = ${order.id}`);
  if (existing[0]?.qrString) return Response.json({ paymentRequestId: existing[0].paymentRequestId, qrSvg: await toQrSvg(existing[0].qrString) });

  const amount = (order.priceBaht + order.shippingFeeBaht) * 100;
  try {
    const referenceId = `season_${order.passCode}_${randomUUID().replace(/-/g, "")}`;
    const created = await createPromptPayPaymentRequest({ referenceId, amountBaht: amount / 100, description: `Pattani FC season pass ${order.passCode}` });
    await prisma.$executeRaw(Prisma.sql`INSERT INTO "XenditPayment"
      ("id", "seasonPassOrderId", "referenceId", "paymentRequestId", "amount", "status", "qrString", "updatedAt")
      VALUES (${randomUUID()}, ${order.id}, ${referenceId}, ${created.paymentRequestId}, ${amount}, 'PENDING', ${created.qrString}, NOW())`);
    return Response.json({ paymentRequestId: created.paymentRequestId, qrSvg: await toQrSvg(created.qrString) });
  } catch (error) {
    return handleCreateError(error, Prisma.sql`WHERE "seasonPassOrderId" = ${order.id}`);
  }
}

async function handleCreateError(error: unknown, where: Prisma.Sql) {
  if (error instanceof Error && error.message.includes("Unique constraint")) {
    const concurrent = await pendingQr(where);
    if (concurrent[0]?.qrString) return Response.json({ paymentRequestId: concurrent[0].paymentRequestId, qrSvg: await toQrSvg(concurrent[0].qrString) });
  }
  console.error("Unable to create Xendit payment", error);
  return Response.json({ error: "ไม่สามารถสร้าง QR ชำระเงินได้ กรุณาลองใหม่" }, { status: 502 });
}
