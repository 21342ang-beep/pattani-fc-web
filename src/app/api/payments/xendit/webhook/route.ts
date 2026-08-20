import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseBeamPaymentReference } from "@/lib/beam-webhook";
import {
  acquirePaymentTargetLock,
  confirmStoredPaymentTarget,
  type StoredPaymentTarget,
} from "@/lib/payment-confirmation";
import {
  InvalidJsonBodyError,
  RequestBodyTooLargeError,
  jsonNoStore,
  readJsonBodyLimited,
} from "@/lib/payment-http";
import {
  PAYMENT_REVIEW_STATUS,
  PAYMENT_SUCCESS_STATUS,
  paymentCanAutomaticallySucceed,
  paymentEnvelopeError,
  paymentStatusAfterFailure,
  paymentTimestampError,
  paymentTargetCount,
  providerAmountToMinorUnits,
} from "@/lib/payment-state";
import { prisma } from "@/lib/prisma";

const MAX_WEBHOOK_BODY_BYTES = 32 * 1024;

const payloadSchema = z.object({
  event: z.string().max(100).optional(),
  api_version: z.string().max(20).optional(),
  business_id: z.string().min(1).max(200),
  data: z.object({
    payment_request_id: z.string().min(1).max(200),
    payment_id: z.string().min(1).max(200).optional(),
    reference_id: z.string().min(1).max(200),
    business_id: z.string().min(1).max(200),
    status: z.string().min(1).max(50),
    currency: z.string().min(3).max(10),
    request_amount: z.number().finite().positive(),
    updated: z.string().min(1).max(100).optional(),
    captures: z.array(z.object({
      capture_amount: z.number().finite().positive(),
      capture_timestamp: z.string().min(1).max(100),
    })).max(10).optional(),
  }).optional(),
});

type XenditPaymentRow = StoredPaymentTarget & {
  id: string;
  paymentRequestId: string;
  paymentId: string | null;
  status: string;
  createdAt: Date;
};

type ProcessingResult =
  | { outcome: "CONFIRMED"; kind: "booking" | "season"; code: string }
  | { outcome: "DUPLICATE" }
  | { outcome: "FAILED_RECORDED" }
  | { outcome: "REVIEW_REQUIRED"; reason: string }
  | { outcome: "IGNORED"; reason: string };

function isValidToken(received: string | null) {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: Request) {
  if (!isValidToken(request.headers.get("x-callback-token"))) {
    return new Response("Invalid callback token", { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await readJsonBodyLimited(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return new Response("Webhook payload too large", { status: 413 });
    }
    if (error instanceof InvalidJsonBodyError) {
      return new Response("Invalid payload", { status: 400 });
    }
    return new Response("Unable to read payload", { status: 400 });
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.data) {
    return jsonNoStore({ ok: true, processed: false });
  }
  const event = parsed.data.event ?? "";
  const data = parsed.data.data;
  const configuredBusinessId = process.env.XENDIT_BUSINESS_ID;
  if (
    (parsed.data.api_version && parsed.data.api_version !== "v3") ||
    parsed.data.business_id !== data.business_id ||
    (configuredBusinessId && parsed.data.business_id !== configuredBusinessId)
  ) {
    return new Response("Invalid Xendit business", { status: 401 });
  }

  let result: ProcessingResult;
  if (event === "payment.capture") {
    if (!data.payment_id || data.status !== "SUCCEEDED") {
      return jsonNoStore({ ok: true, processed: false });
    }
    const receivedAmount = providerAmountToMinorUnits(data.request_amount);
    const captureTotal = data.captures?.reduce(
      (sum, capture) => sum + capture.capture_amount,
      0,
    );
    const captureAmount = captureTotal == null
      ? receivedAmount
      : providerAmountToMinorUnits(captureTotal);
    const timestamp = data.captures?.at(-1)?.capture_timestamp ?? data.updated;
    const paidAt = timestamp ? new Date(timestamp) : null;
    const providerEnvelopeError = data.currency !== "THB"
      ? "currency_mismatch"
      : receivedAmount == null
        ? "invalid_provider_amount"
        : captureAmount == null || captureAmount !== receivedAmount
          ? "capture_amount_mismatch"
          : !paidAt || Number.isNaN(paidAt.getTime())
            ? "capture_timestamp_missing"
            : null;
    result = await processCapture({
      paymentRequestId: data.payment_request_id,
      paymentId: data.payment_id,
      referenceId: data.reference_id,
      receivedAmount,
      paidAt,
      providerEnvelopeError,
    });
  } else if (event === "payment.failure") {
    if (data.status !== "FAILED") return jsonNoStore({ ok: true, processed: false });
    result = await processFailure({
      paymentRequestId: data.payment_request_id,
      paymentId: data.payment_id ?? null,
      referenceId: data.reference_id,
    });
  } else {
    return jsonNoStore({ ok: true, processed: false });
  }

  if (result.outcome === "CONFIRMED") revalidatePaymentViews(result.kind, result.code);
  return jsonNoStore({
    ok: true,
    processed: result.outcome !== "IGNORED",
    reviewRequired: result.outcome === "REVIEW_REQUIRED",
  });
}

async function processCapture(input: {
  paymentRequestId: string;
  paymentId: string;
  referenceId: string;
  receivedAmount: number | null;
  paidAt: Date | null;
  providerEnvelopeError: string | null;
}): Promise<ProcessingResult> {
  const reference = parseBeamPaymentReference(input.referenceId);
  if (!reference) return { outcome: "IGNORED", reason: "unsupported_reference" };
  const preliminary = await findXenditPayment(input.paymentRequestId);
  if (!preliminary || preliminary.referenceId !== input.referenceId) {
    return { outcome: "IGNORED", reason: "payment_not_found" };
  }

  return prisma.$transaction(async (tx) => {
    await acquirePaymentTargetLock(tx, preliminary);
    const rows = await lockXenditPayment(tx, preliminary.id);
    const payment = rows[0];
    if (!payment || payment.referenceId !== input.referenceId) {
      return { outcome: "IGNORED", reason: "payment_changed" } as const;
    }
    const envelopeError = input.providerEnvelopeError ?? paymentEnvelopeError({
      storedAmount: payment.amount,
      receivedAmount: input.receivedAmount ?? Number.NaN,
      storedProviderId: payment.paymentId,
      receivedProviderId: input.paymentId,
      targetCount: paymentTargetCount(payment),
    });
    if (envelopeError) {
      return markXenditReview(tx, payment, input.paymentId, envelopeError);
    }
    const providerOwner = await tx.xenditPayment.findUnique({
      where: { paymentId: input.paymentId },
      select: { id: true },
    });
    if (providerOwner && providerOwner.id !== payment.id) {
      return markXenditReview(
        tx,
        payment,
        input.paymentId,
        "provider_id_owned_by_other_payment",
      );
    }
    const timestampError = paymentTimestampError({
      paidAt: input.paidAt!,
      paymentCreatedAt: payment.createdAt,
      paymentExpiresAt: null,
    });
    if (timestampError) {
      return markXenditReview(tx, payment, input.paymentId, timestampError);
    }
    if (payment.status === PAYMENT_SUCCESS_STATUS) return { outcome: "DUPLICATE" } as const;
    if (payment.status === PAYMENT_REVIEW_STATUS) {
      return { outcome: "REVIEW_REQUIRED", reason: "payment_already_in_review" } as const;
    }
    if (!paymentCanAutomaticallySucceed(payment.status)) {
      return markXenditReview(tx, payment, input.paymentId, `invalid_source_status_${payment.status}`);
    }

    // Use the provider's capture/update timestamp rather than callback receipt
    // time, so a delayed retry can still confirm a payment completed on time.
    const confirmation = await confirmStoredPaymentTarget(tx, payment, {
      reference,
      paidAt: input.paidAt!,
      paymentMethod: "XENDIT_PROMPTPAY",
    });
    if (confirmation.outcome === "REVIEW_REQUIRED") {
      return markXenditReview(tx, payment, input.paymentId, confirmation.reason);
    }

    const succeeded = await tx.xenditPayment.updateMany({
      where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: PAYMENT_SUCCESS_STATUS, paymentId: input.paymentId },
    });
    if (succeeded.count !== 1) throw new Error("XENDIT_PAYMENT_STATE_CHANGED");
    return {
      outcome: "CONFIRMED",
      kind: confirmation.kind,
      code: confirmation.code,
    } as const;
  });
}

async function processFailure(input: {
  paymentRequestId: string;
  paymentId: string | null;
  referenceId: string;
}): Promise<ProcessingResult> {
  if (!parseBeamPaymentReference(input.referenceId)) {
    return { outcome: "IGNORED", reason: "unsupported_reference" };
  }
  const preliminary = await findXenditPayment(input.paymentRequestId);
  if (!preliminary || preliminary.referenceId !== input.referenceId) {
    return { outcome: "IGNORED", reason: "payment_not_found" };
  }

  return prisma.$transaction(async (tx) => {
    await acquirePaymentTargetLock(tx, preliminary);
    const rows = await lockXenditPayment(tx, preliminary.id);
    const payment = rows[0];
    if (!payment || payment.referenceId !== input.referenceId) {
      return { outcome: "IGNORED", reason: "payment_changed" } as const;
    }
    if (paymentTargetCount(payment) !== 1) {
      return markXenditReview(tx, payment, input.paymentId, "invalid_payment_target");
    }
    if (input.paymentId && payment.paymentId && payment.paymentId !== input.paymentId) {
      return markXenditReview(tx, payment, input.paymentId, "provider_id_mismatch");
    }
    const providerOwner = input.paymentId
      ? await tx.xenditPayment.findUnique({
          where: { paymentId: input.paymentId },
          select: { id: true },
        })
      : null;
    if (providerOwner && providerOwner.id !== payment.id) {
      return markXenditReview(
        tx,
        payment,
        input.paymentId,
        "provider_id_owned_by_other_payment",
      );
    }
    const nextStatus = paymentStatusAfterFailure(payment.status);
    if (nextStatus === payment.status) {
      if (payment.status === PAYMENT_SUCCESS_STATUS) return { outcome: "DUPLICATE" } as const;
      if (payment.status === PAYMENT_REVIEW_STATUS) {
        return { outcome: "REVIEW_REQUIRED", reason: "payment_already_in_review" } as const;
      }
      return { outcome: "FAILED_RECORDED" } as const;
    }
    await tx.xenditPayment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        ...(!payment.paymentId && input.paymentId ? { paymentId: input.paymentId } : {}),
      },
    });
    return { outcome: "FAILED_RECORDED" } as const;
  });
}

function findXenditPayment(paymentRequestId: string) {
  return prisma.xenditPayment.findUnique({
    where: { paymentRequestId },
    select: {
      id: true,
      bookingId: true,
      seasonPassOrderId: true,
      seasonPassPurchaseId: true,
      referenceId: true,
      paymentRequestId: true,
      paymentId: true,
      amount: true,
      status: true,
      createdAt: true,
    },
  });
}

function lockXenditPayment(tx: Prisma.TransactionClient, id: string) {
  return tx.$queryRaw<XenditPaymentRow[]>(Prisma.sql`
    SELECT "id", "bookingId", "seasonPassOrderId", "seasonPassPurchaseId",
           "referenceId", "paymentRequestId", "paymentId", "amount", "status", "createdAt"
    FROM "XenditPayment" WHERE "id" = ${id} FOR UPDATE
  `);
}

async function markXenditReview(
  tx: Prisma.TransactionClient,
  payment: XenditPaymentRow,
  paymentId: string | null,
  reason: string,
): Promise<ProcessingResult> {
  console.warn("Xendit payment requires manual review", {
    paymentRecordId: payment.id,
    providerPaymentId: paymentId,
    previousStatus: payment.status,
    reason,
  });
  if (payment.status !== PAYMENT_SUCCESS_STATUS) {
    const providerOwner = !payment.paymentId && paymentId
      ? await tx.xenditPayment.findUnique({
          where: { paymentId },
          select: { id: true },
        })
      : null;
    await tx.xenditPayment.update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_REVIEW_STATUS,
        ...(!payment.paymentId && paymentId && (!providerOwner || providerOwner.id === payment.id)
          ? { paymentId }
          : {}),
      },
    });
  }
  return { outcome: "REVIEW_REQUIRED", reason };
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
