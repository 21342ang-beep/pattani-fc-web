import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BeamApiError, createBeamPromptPayCharge } from "@/lib/beam";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  bookingCode: z.string().trim().min(8).max(50).regex(/^[a-z0-9]+$/i).optional(),
  seasonPassCode: z.string().trim().min(8).max(100).regex(/^[a-z0-9-]+$/i).optional(),
}).refine((value) => Boolean(value.bookingCode) !== Boolean(value.seasonPassCode), {
  message: "Provide exactly one payment target",
});

type PaymentRow = {
  id: string;
  referenceId: string;
  idempotencyKey: string;
  chargeId: string | null;
  qrImageBase64: string | null;
  expiresAt: Date | null;
};

async function preparePayment(input: {
  bookingId?: string;
  seasonPassOrderId?: string;
  referencePrefix: string;
  amount: number;
}) {
  const lockKey = input.bookingId ? `booking:${input.bookingId}` : `season:${input.seasonPassOrderId}`;
  const target = input.bookingId
    ? Prisma.sql`"bookingId" = ${input.bookingId}`
    : Prisma.sql`"seasonPassOrderId" = ${input.seasonPassOrderId}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    await tx.$executeRaw(Prisma.sql`UPDATE "BeamPayment" SET "status" = 'EXPIRED', "updatedAt" = NOW()
      WHERE ${target} AND "status" = 'PENDING' AND "expiresAt" <= NOW()`);

    const reusable = await tx.$queryRaw<PaymentRow[]>(Prisma.sql`SELECT "id", "referenceId", "idempotencyKey",
        "chargeId", "qrImageBase64", "expiresAt"
      FROM "BeamPayment"
      WHERE ${target} AND (
        ("status" = 'PENDING' AND "expiresAt" > NOW() + INTERVAL '10 seconds' AND "qrImageBase64" IS NOT NULL)
        OR ("status" = 'INITIATED' AND "createdAt" > NOW() - INTERVAL '12 hours')
      )
      ORDER BY "createdAt" DESC LIMIT 1`);
    if (reusable[0]) return reusable[0];

    const id = randomUUID();
    const referenceId = `${input.referencePrefix}_${randomUUID().replace(/-/g, "")}`;
    const idempotencyKey = randomUUID();
    await tx.$executeRaw(Prisma.sql`INSERT INTO "BeamPayment"
      ("id", "bookingId", "seasonPassOrderId", "referenceId", "idempotencyKey", "amount", "status", "updatedAt")
      VALUES (${id}, ${input.bookingId ?? null}, ${input.seasonPassOrderId ?? null}, ${referenceId}, ${idempotencyKey}, ${input.amount}, 'INITIATED', NOW())`);
    return { id, referenceId, idempotencyKey, chargeId: null, qrImageBase64: null, expiresAt: null };
  });
}

function readyResponse(payment: PaymentRow) {
  if (!payment.chargeId || !payment.qrImageBase64 || !payment.expiresAt) return null;
  return Response.json({
    chargeId: payment.chargeId,
    qrImageBase64: payment.qrImageBase64,
    expiresAt: payment.expiresAt.toISOString(),
  });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, { status: 400 });
  return parsed.data.seasonPassCode
    ? createSeasonPassPayment(request, parsed.data.seasonPassCode)
    : createBookingPayment(request, parsed.data.bookingCode!);
}

async function createBookingPayment(request: Request, bookingCode: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingCode },
    select: { id: true, bookingCode: true, totalAmount: true, status: true },
  });
  if (!booking) return Response.json({ error: "ไม่พบรายการจอง" }, { status: 404 });
  if (booking.status !== "PENDING") return Response.json({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });

  const payment = await preparePayment({
    bookingId: booking.id,
    referencePrefix: `booking_${booking.bookingCode}`,
    amount: booking.totalAmount,
  });
  return finishCharge(request, payment, booking.totalAmount, `/tickets/${booking.bookingCode}`);
}

async function createSeasonPassPayment(request: Request, seasonPassCode: string) {
  const order = await prisma.seasonPassOrder.findUnique({
    where: { passCode: seasonPassCode },
    select: { id: true, passCode: true, priceBaht: true, shippingFeeBaht: true, status: true },
  });
  if (!order) return Response.json({ error: "ไม่พบรายการสมัครบัตรรายปี" }, { status: 404 });
  if (order.status !== "PENDING") return Response.json({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });

  const amount = (order.priceBaht + order.shippingFeeBaht) * 100;
  const payment = await preparePayment({
    seasonPassOrderId: order.id,
    referencePrefix: `season_${order.passCode}`,
    amount,
  });
  return finishCharge(request, payment, amount, `/tickets/season/${encodeURIComponent(order.passCode)}`);
}

async function finishCharge(request: Request, payment: PaymentRow, amount: number, successPath: string) {
  const ready = readyResponse(payment);
  if (ready) return ready;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const expiryTime = new Date(Date.now() + 15 * 60 * 1000);
  try {
    const charge = await createBeamPromptPayCharge({
      referenceId: payment.referenceId,
      amount,
      returnUrl: new URL(successPath, appUrl).toString(),
      expiryTime,
      idempotencyKey: payment.idempotencyKey,
    });
    if (charge.qrImageBase64.length > 2_000_000) throw new BeamApiError("QR Code จาก Beam มีขนาดใหญ่เกินไป", false);

    await prisma.$executeRaw(Prisma.sql`UPDATE "BeamPayment"
      SET "chargeId" = ${charge.chargeId}, "qrImageBase64" = ${charge.qrImageBase64},
          "expiresAt" = ${charge.expiresAt}, "status" = 'PENDING', "updatedAt" = NOW()
      WHERE "id" = ${payment.id}`);
    return Response.json({
      chargeId: charge.chargeId,
      qrImageBase64: charge.qrImageBase64,
      expiresAt: charge.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof BeamApiError && !error.retryable) {
      await prisma.$executeRaw(Prisma.sql`UPDATE "BeamPayment" SET "status" = 'FAILED', "updatedAt" = NOW()
        WHERE "id" = ${payment.id} AND "status" = 'INITIATED'`);
    }
    console.error("Unable to create Beam PromptPay charge", {
      retryable: error instanceof BeamApiError ? error.retryable : true,
    });
    const message = error instanceof BeamApiError ? error.message : "ไม่สามารถสร้าง QR ชำระเงินได้ กรุณาลองใหม่";
    return Response.json({ error: message }, { status: 502 });
  }
}
