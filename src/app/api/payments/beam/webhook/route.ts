import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { parseBeamPaymentReference, verifyBeamSignature } from "@/lib/beam-webhook";
import { prisma } from "@/lib/prisma";
import { expirePendingSeasonPassPurchases } from "@/lib/season-pass-expiry";

export const runtime = "nodejs";

type BeamPayload = {
  chargeId?: unknown;
  merchantId?: unknown;
  referenceId?: unknown;
  status?: unknown;
  amount?: unknown;
  transactionTime?: unknown;
  paymentMethod?: { paymentMethodType?: unknown } | null;
  order?: { referenceId?: unknown; netAmount?: unknown } | null;
};

type PaymentDetails = {
  chargeId: string | null;
  referenceId: string;
  amount: number;
  paymentMethod: string;
  paidAt: Date;
};

function paymentDetails(event: string, payload: BeamPayload): PaymentDetails | null {
  if (event === "payment_link.paid") {
    if (payload.status !== "PAID" || typeof payload.order?.referenceId !== "string" || !Number.isInteger(payload.order.netAmount)) {
      return null;
    }
    return {
      chargeId: null,
      referenceId: payload.order.referenceId,
      amount: payload.order.netAmount as number,
      paymentMethod: "BEAM",
      paidAt: new Date(),
    };
  }

  if (event === "charge.succeeded") {
    if (payload.status !== "SUCCEEDED" || typeof payload.referenceId !== "string" || !Number.isInteger(payload.amount)) {
      return null;
    }
    const method = typeof payload.paymentMethod?.paymentMethodType === "string"
      ? payload.paymentMethod.paymentMethodType.replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 40)
      : "UNKNOWN";
    const transactionTime = typeof payload.transactionTime === "string" ? new Date(payload.transactionTime) : new Date();
    return {
      chargeId: typeof payload.chargeId === "string" ? payload.chargeId : null,
      referenceId: payload.referenceId,
      amount: payload.amount as number,
      paymentMethod: `BEAM_${method}`,
      paidAt: Number.isNaN(transactionTime.getTime()) ? new Date() : transactionTime,
    };
  }

  return null;
}

function revalidatePaymentViews(kind: "booking" | "season", code: string) {
  if (kind === "booking") {
    revalidatePath(`/tickets/${code}`);
    revalidatePath(`/checkout/${code}`);
  } else {
    revalidatePath(`/tickets/season/${code}`);
    revalidatePath(`/checkout/season/${code}`);
  }
  revalidatePath("/member/bookings");
  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath("/matches");
  revalidatePath("/admin/matches");
  revalidateTag("bookings", { expire: 0 });
}

export async function POST(request: Request) {
  const encodedHmacKey = process.env.BEAM_WEBHOOK_HMAC_KEY;
  if (!encodedHmacKey) {
    console.error("Beam webhook is not configured: BEAM_WEBHOOK_HMAC_KEY is missing");
    return new Response("Webhook is not configured", { status: 503 });
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (!verifyBeamSignature(rawBody, request.headers.get("x-beam-signature"), encodedHmacKey)) {
    return new Response("Invalid Beam signature", { status: 401 });
  }

  let payload: BeamPayload;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(rawBody).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new Response("Invalid JSON payload", { status: 400 });
    }
    payload = parsed as BeamPayload;
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const event = request.headers.get("x-beam-event") ?? "";
  const merchantId = process.env.BEAM_MERCHANT_ID;
  if (merchantId && typeof payload.merchantId === "string" && payload.merchantId !== merchantId) {
    return new Response("Invalid Beam merchant", { status: 401 });
  }

  if (event === "charge.failed" && typeof payload.referenceId === "string") {
    const result = await prisma.$executeRaw(Prisma.sql`UPDATE "BeamPayment"
      SET "status" = 'FAILED', "chargeId" = COALESCE(${typeof payload.chargeId === "string" ? payload.chargeId : null}, "chargeId"),
          "updatedAt" = NOW()
      WHERE "referenceId" = ${payload.referenceId}`);
    const reference = parseBeamPaymentReference(payload.referenceId);
    if (reference?.kind === "booking") {
      const cancelled = await prisma.booking.updateMany({
        where: {
          bookingCode: reference.code,
          status: "PENDING",
          paymentExpiresAt: { lte: new Date() },
        },
        data: { status: "CANCELLED" },
      });
      if (cancelled.count > 0) revalidatePaymentViews("booking", reference.code);
    } else if (reference?.kind === "season") {
      const cancelled = await expirePendingSeasonPassPurchases({
        purchaseCode: reference.code,
        passCode: reference.code,
      });
      if (cancelled.count > 0) revalidatePaymentViews("season", reference.code);
    }
    return Response.json({ ok: true, processed: result > 0 });
  }

  const payment = paymentDetails(event, payload);
  if (!payment) return Response.json({ ok: true, processed: false });

  const reference = parseBeamPaymentReference(payment.referenceId);
  if (!reference) {
    console.warn("Ignored Beam payment with an unsupported reference format", { event });
    return Response.json({ ok: true, processed: false });
  }

  let updated = 0;
  await prisma.$executeRaw(Prisma.sql`UPDATE "BeamPayment"
    SET "status" = 'SUCCEEDED', "chargeId" = COALESCE(${payment.chargeId}, "chargeId"), "updatedAt" = NOW()
    WHERE "referenceId" = ${payment.referenceId}`);
  if (reference.kind === "booking") {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { bookingCode: reference.code },
        select: { id: true, matchId: true },
      });
      if (!booking) return { count: 0 };
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`match-capacity:${booking.matchId}`}))`);
      return tx.booking.updateMany({
        where: {
          id: booking.id,
          status: { in: ["PENDING", "CANCELLED"] },
          salesChannel: "ONLINE",
          paidAt: null,
          totalAmount: payment.amount,
          // Accept a delayed webhook only when Beam says payment happened
          // before the exact QR deadline stored on the booking.
          paymentExpiresAt: { gte: payment.paidAt },
        },
        data: { status: "CONFIRMED", paymentMethod: payment.paymentMethod, paidAt: payment.paidAt },
      });
    });
    updated = result.count;
  } else {
    const purchase = await prisma.seasonPassPurchase.findUnique({
      where: { purchaseCode: reference.code },
      select: { id: true, totalBaht: true, status: true, paymentExpiresAt: true },
    });
    if (
      purchase?.status === "PENDING" &&
      purchase.totalBaht * 100 === payment.amount &&
      (!purchase.paymentExpiresAt || purchase.paymentExpiresAt >= payment.paidAt)
    ) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-purchase:${purchase.id}`}))`;
        const updatedPurchase = await tx.seasonPassPurchase.updateMany({
          where: {
            id: purchase.id,
            status: "PENDING",
            OR: [
              { paymentExpiresAt: null },
              { paymentExpiresAt: { gte: payment.paidAt } },
            ],
          },
          data: { status: "CONFIRMED", paymentMethod: payment.paymentMethod },
        });
        if (updatedPurchase.count > 0) {
          await tx.seasonPassOrder.updateMany({
            where: { purchaseId: purchase.id, status: "PENDING" },
            data: { status: "CONFIRMED", paymentMethod: payment.paymentMethod },
          });
        }
        return updatedPurchase;
      });
      updated = result.count;
    } else if (!purchase) {
    const order = await prisma.seasonPassOrder.findUnique({
      where: { passCode: reference.code },
      select: { id: true, priceBaht: true, shippingFeeBaht: true, status: true },
    });
    if (order?.status === "PENDING" && (order.priceBaht + order.shippingFeeBaht) * 100 === payment.amount) {
      const result = await prisma.seasonPassOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "CONFIRMED", paymentMethod: payment.paymentMethod },
      });
      updated = result.count;
    }
    }
  }

  if (updated > 0) revalidatePaymentViews(reference.kind, reference.code);
  return Response.json({ ok: true, processed: updated > 0 });
}
