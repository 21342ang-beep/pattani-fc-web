import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BeamApiError, createBeamPromptPayCharge } from "@/lib/beam";
import { BOOKING_RESERVATION_MS, expirePendingBookings } from "@/lib/booking-expiry";
import { acquirePaymentTargetLock } from "@/lib/payment-confirmation";
import {
  InvalidJsonBodyError,
  RequestBodyTooLargeError,
  jsonNoStore,
  paymentTargetNotFound,
  rateLimitedJson,
  readJsonBodyLimited,
} from "@/lib/payment-http";
import { PAYMENT_REVIEW_STATUS, PAYMENT_SUCCESS_STATUS } from "@/lib/payment-state";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { expirePendingSeasonPassPurchases } from "@/lib/season-pass-expiry";
import { hasBookingAccess } from "@/lib/booking-access";
import { hasSeasonPaymentAccess } from "@/lib/season-payment-access";

const bodySchema = z.object({
  bookingCode: z.string().trim().min(8).max(50).regex(/^[a-z0-9]+$/i).optional(),
  seasonPassCode: z.string().trim().min(8).max(100).regex(/^[a-z0-9-]+$/i).optional(),
}).refine((value) => Boolean(value.bookingCode) !== Boolean(value.seasonPassCode), {
  message: "Provide exactly one payment target",
});

type PaymentRow = {
  id: string;
  bookingId: string | null;
  seasonPassOrderId: string | null;
  seasonPassPurchaseId: string | null;
  referenceId: string;
  idempotencyKey: string;
  chargeId: string | null;
  qrImageBase64: string | null;
  expiresAt: Date | null;
  amount: number;
  status: string;
};

const MAX_CREATE_BODY_BYTES = 4 * 1024;

async function preparePayment(input: {
  bookingId?: string;
  seasonPassOrderId?: string;
  seasonPassPurchaseId?: string;
  referencePrefix: string;
  amount: number;
}) {
  const lockKey = input.bookingId
    ? `booking:${input.bookingId}`
    : input.seasonPassPurchaseId
      ? `season-purchase:${input.seasonPassPurchaseId}`
      : `season:${input.seasonPassOrderId}`;
  const target = input.bookingId
    ? Prisma.sql`"bookingId" = ${input.bookingId}`
    : input.seasonPassPurchaseId
      ? Prisma.sql`"seasonPassPurchaseId" = ${input.seasonPassPurchaseId}`
      : Prisma.sql`"seasonPassOrderId" = ${input.seasonPassOrderId}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    await tx.$executeRaw(Prisma.sql`UPDATE "BeamPayment" SET "status" = 'EXPIRED',
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      WHERE ${target} AND "status" = 'PENDING'
        AND "expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`);
    await tx.$executeRaw(Prisma.sql`UPDATE "BeamPayment" SET "status" = ${PAYMENT_REVIEW_STATUS},
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      WHERE ${target} AND "status" IN ('INITIATED', 'PENDING') AND "amount" <> ${input.amount}`);

    const reusable = await tx.$queryRaw<PaymentRow[]>(Prisma.sql`SELECT "id", "bookingId", "seasonPassOrderId",
        "seasonPassPurchaseId", "referenceId", "idempotencyKey", "chargeId", "qrImageBase64", "expiresAt",
        "amount", "status"
      FROM "BeamPayment"
      WHERE ${target} AND "amount" = ${input.amount} AND (
        ("status" = 'PENDING'
          AND "expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '10 seconds'
          AND "qrImageBase64" IS NOT NULL)
        OR ("status" = 'INITIATED'
          AND "createdAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '12 hours')
      )
      ORDER BY "createdAt" DESC LIMIT 1`);
    if (reusable[0]) return reusable[0];

    const id = randomUUID();
    const referenceId = `${input.referencePrefix}_${randomUUID().replace(/-/g, "")}`;
    const idempotencyKey = randomUUID();
    await tx.$executeRaw(Prisma.sql`INSERT INTO "BeamPayment"
      ("id", "bookingId", "seasonPassOrderId", "seasonPassPurchaseId", "referenceId", "idempotencyKey",
       "amount", "status", "createdAt", "updatedAt")
      VALUES (${id}, ${input.bookingId ?? null}, ${input.seasonPassOrderId ?? null},
              ${input.seasonPassPurchaseId ?? null}, ${referenceId}, ${idempotencyKey}, ${input.amount},
              'INITIATED', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
              (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))`);
    return {
      id,
      bookingId: input.bookingId ?? null,
      seasonPassOrderId: input.seasonPassOrderId ?? null,
      seasonPassPurchaseId: input.seasonPassPurchaseId ?? null,
      referenceId,
      idempotencyKey,
      chargeId: null,
      qrImageBase64: null,
      expiresAt: null,
      amount: input.amount,
      status: "INITIATED",
    };
  });
}

function readyResponse(payment: PaymentRow) {
  if (!payment.chargeId || !payment.qrImageBase64 || !payment.expiresAt) return null;
  return jsonNoStore({
    chargeId: payment.chargeId,
    qrImageBase64: payment.qrImageBase64,
    expiresAt: payment.expiresAt.toISOString(),
  });
}

export async function POST(request: Request) {
  const rl = await rateLimit("beam_payment_create", { max: 120, windowMs: 60_000 });
  if (!rl.ok) return rateLimitedJson(rl.retryAfterSec);

  let raw: unknown;
  try {
    raw = await readJsonBodyLimited(request, MAX_CREATE_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonNoStore({ error: "ข้อมูลการชำระเงินมีขนาดใหญ่เกินไป" }, { status: 413 });
    }
    if (error instanceof InvalidJsonBodyError) {
      return jsonNoStore({ error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, { status: 400 });
    }
    return jsonNoStore({ error: "ไม่สามารถอ่านข้อมูลการชำระเงินได้" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonNoStore({ error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, { status: 400 });
  return parsed.data.seasonPassCode
    ? createSeasonPassPayment(request, parsed.data.seasonPassCode)
    : createBookingPayment(request, parsed.data.bookingCode!);
}

async function createBookingPayment(request: Request, bookingCode: string) {
  await expirePendingBookings({ bookingCode });
  const booking = await prisma.booking.findUnique({
    where: { bookingCode },
    select: {
      id: true,
      bookingCode: true,
      customerId: true,
      customerPhone: true,
      totalAmount: true,
      status: true,
    },
  });
  if (!booking || !(await hasBookingAccess(booking))) {
    return paymentTargetNotFound();
  }
  if (booking.status !== "PENDING") return jsonNoStore({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });

  const payment = await preparePayment({
    bookingId: booking.id,
    referencePrefix: `booking_${booking.bookingCode}`,
    amount: booking.totalAmount,
  });
  return finishCharge(request, payment, booking.totalAmount, `/tickets/${booking.bookingCode}`, { bookingId: booking.id });
}

async function createSeasonPassPayment(request: Request, seasonPassCode: string) {
  await expirePendingSeasonPassPurchases({ purchaseCode: seasonPassCode, passCode: seasonPassCode });
  const purchase = await prisma.seasonPassPurchase.findUnique({
    where: { purchaseCode: seasonPassCode },
    select: {
      id: true,
      purchaseCode: true,
      customerId: true,
      customerEmail: true,
      totalBaht: true,
      quantity: true,
      status: true,
    },
  });
  if (purchase) {
    if (!(await hasSeasonPaymentAccess(purchase))) return paymentTargetNotFound();
    if (purchase.status !== "PENDING") {
      return jsonNoStore({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });
    }
    const amount = purchase.totalBaht * 100;
    const payment = await preparePayment({
      seasonPassPurchaseId: purchase.id,
      referencePrefix: `season_${purchase.purchaseCode}`,
      amount,
    });
    const successPath = purchase.quantity > 1 ? "/member/bookings" : `/checkout/season/${encodeURIComponent(purchase.purchaseCode)}`;
    return finishCharge(request, payment, amount, successPath, { seasonPassPurchaseId: purchase.id });
  }

  const order = await prisma.seasonPassOrder.findFirst({
    where: { passCode: seasonPassCode, purchaseId: null },
    select: {
      id: true,
      passCode: true,
      customerId: true,
      customerEmail: true,
      priceBaht: true,
      shippingFeeBaht: true,
      status: true,
    },
  });
  if (!order || !(await hasSeasonPaymentAccess(order))) return paymentTargetNotFound();
  if (order.status !== "PENDING") return jsonNoStore({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });

  const amount = (order.priceBaht + order.shippingFeeBaht) * 100;
  const payment = await preparePayment({
    seasonPassOrderId: order.id,
    referencePrefix: `season_${order.passCode}`,
    amount,
  });
  return finishCharge(request, payment, amount, `/tickets/season/${encodeURIComponent(order.passCode)}`);
}

async function finishCharge(
  request: Request,
  payment: PaymentRow,
  amount: number,
  successPath: string,
  target?: { bookingId?: string; seasonPassPurchaseId?: string },
) {
  const ready = readyResponse(payment);
  if (ready) return ready;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const expiryTime = new Date(Date.now() + (target?.bookingId ? BOOKING_RESERVATION_MS : 15 * 60 * 1000));
  try {
    const charge = await createBeamPromptPayCharge({
      referenceId: payment.referenceId,
      amount,
      returnUrl: new URL(successPath, appUrl).toString(),
      expiryTime,
      idempotencyKey: payment.idempotencyKey,
    });
    if (charge.qrImageBase64.length > 2_000_000) throw new BeamApiError("QR Code จาก Beam มีขนาดใหญ่เกินไป", false);

    const bookingActivated = await prisma.$transaction(async (tx) => {
      await acquirePaymentTargetLock(tx, payment);
      const locked = await tx.$queryRaw<Array<{ chargeId: string | null; status: string }>>(Prisma.sql`
        SELECT "chargeId", "status" FROM "BeamPayment" WHERE "id" = ${payment.id} FOR UPDATE
      `);
      const current = locked[0];
      if (!current) return false;
      if (current.chargeId && current.chargeId !== charge.chargeId) {
        if (current.status !== PAYMENT_SUCCESS_STATUS) {
          await tx.beamPayment.update({
            where: { id: payment.id },
            data: { status: PAYMENT_REVIEW_STATUS },
          });
        }
        return false;
      }
      const providerOwner = await tx.beamPayment.findUnique({
        where: { chargeId: charge.chargeId },
        select: { id: true },
      });
      if (providerOwner && providerOwner.id !== payment.id) {
        await tx.beamPayment.updateMany({
          where: { id: payment.id, status: { not: PAYMENT_SUCCESS_STATUS } },
          data: { status: PAYMENT_REVIEW_STATUS },
        });
        return false;
      }
      const nextStatus = current.status === "INITIATED" || current.status === "PENDING"
        ? "PENDING"
        : current.status === PAYMENT_SUCCESS_STATUS
          ? PAYMENT_SUCCESS_STATUS
          : PAYMENT_REVIEW_STATUS;
      await tx.beamPayment.update({
        where: { id: payment.id },
        data: {
          chargeId: charge.chargeId,
          qrImageBase64: charge.qrImageBase64,
          expiresAt: charge.expiresAt,
          status: nextStatus,
        },
      });
      if (nextStatus === PAYMENT_SUCCESS_STATUS) return true;
      if (nextStatus === PAYMENT_REVIEW_STATUS) return false;
      if (!target?.bookingId && !target?.seasonPassPurchaseId) return true;
      const result = target.bookingId
        ? await tx.booking.updateMany({
            where: {
              id: target.bookingId,
              status: "PENDING",
              paymentExpiresAt: { gt: new Date() },
            },
            data: { paymentExpiresAt: charge.expiresAt },
          })
        : await tx.seasonPassPurchase.updateMany({
            where: {
              id: target.seasonPassPurchaseId!,
              status: "PENDING",
              paymentExpiresAt: { gt: new Date() },
            },
            data: { paymentExpiresAt: charge.expiresAt },
          });
      if (result.count === 0) {
        await tx.beamPayment.updateMany({
          where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } },
          data: { status: "EXPIRED" },
        });
      }
      return result.count > 0;
    });
    if (!bookingActivated) {
      return jsonNoStore({ error: "หมดเวลาชำระเงินแล้วหรือรายการต้องตรวจสอบ กรุณาติดต่อเจ้าหน้าที่" }, { status: 409 });
    }
    return jsonNoStore({
      chargeId: charge.chargeId,
      qrImageBase64: charge.qrImageBase64,
      expiresAt: charge.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof BeamApiError && !error.retryable) {
      await prisma.$executeRaw(Prisma.sql`UPDATE "BeamPayment" SET "status" = 'FAILED',
          "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        WHERE "id" = ${payment.id} AND "status" = 'INITIATED'`);
    }
    console.error("Unable to create Beam PromptPay charge", {
      retryable: error instanceof BeamApiError ? error.retryable : true,
    });
    const message = error instanceof BeamApiError ? error.message : "ไม่สามารถสร้าง QR ชำระเงินได้ กรุณาลองใหม่";
    return jsonNoStore({ error: message }, { status: 502 });
  }
}
