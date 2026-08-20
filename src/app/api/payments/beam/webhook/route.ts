import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { parseBeamPaymentReference, verifyBeamSignature } from "@/lib/beam-webhook";
import {
  acquirePaymentTargetLock,
  confirmStoredPaymentTarget,
  type StoredPaymentTarget,
} from "@/lib/payment-confirmation";
import {
  InvalidJsonBodyError,
  RequestBodyTooLargeError,
  jsonNoStore,
  readRequestBodyLimited,
} from "@/lib/payment-http";
import {
  PAYMENT_REVIEW_STATUS,
  PAYMENT_SUCCESS_STATUS,
  paymentCanAutomaticallySucceed,
  paymentEnvelopeError,
  paymentStatusAfterFailure,
  paymentTimestampError,
  paymentTargetCount,
} from "@/lib/payment-state";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

type BeamPayload = {
  chargeId?: unknown;
  merchantId?: unknown;
  referenceId?: unknown;
  status?: unknown;
  currency?: unknown;
  amount?: unknown;
  transactionTime?: unknown;
  paymentMethod?: { paymentMethodType?: unknown } | null;
};

type BeamPaymentRow = StoredPaymentTarget & {
  id: string;
  chargeId: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
};

type PaymentDetails = {
  chargeId: string;
  referenceId: string;
  amount: number | null;
  paymentMethod: string;
  paidAt: Date | null;
  providerEnvelopeError: string | null;
};

type ProcessingResult =
  | { outcome: "CONFIRMED"; kind: "booking" | "season"; code: string }
  | { outcome: "DUPLICATE" }
  | { outcome: "FAILED_RECORDED" }
  | { outcome: "REVIEW_REQUIRED"; reason: string }
  | { outcome: "IGNORED"; reason: string };

function successfulPaymentDetails(payload: BeamPayload): PaymentDetails | null {
  if (
    payload.status !== "SUCCEEDED" ||
    typeof payload.chargeId !== "string" ||
    payload.chargeId.length === 0 ||
    typeof payload.referenceId !== "string"
  ) {
    return null;
  }
  const method = typeof payload.paymentMethod?.paymentMethodType === "string"
    ? payload.paymentMethod.paymentMethodType.replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 40)
    : "UNKNOWN";
  const transactionTime = typeof payload.transactionTime === "string"
    ? new Date(payload.transactionTime)
    : new Date(Number.NaN);
  const amount = Number.isSafeInteger(payload.amount) && (payload.amount as number) > 0
    ? payload.amount as number
    : null;
  const paidAt = Number.isNaN(transactionTime.getTime()) ? null : transactionTime;
  const providerEnvelopeError = payload.currency !== "THB"
    ? "currency_mismatch"
    : amount == null
      ? "invalid_provider_amount"
      : paidAt == null
        ? "invalid_payment_timestamp"
        : null;
  return {
    chargeId: payload.chargeId,
    referenceId: payload.referenceId,
    amount,
    paymentMethod: `BEAM_${method}`,
    paidAt,
    providerEnvelopeError,
  };
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
  const merchantId = process.env.BEAM_MERCHANT_ID;
  if (!encodedHmacKey || !merchantId) {
    console.error("Beam webhook is not configured");
    return new Response("Webhook is not configured", { status: 503 });
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readRequestBodyLimited(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return new Response("Webhook payload too large", { status: 413 });
    }
    return new Response("Unable to read webhook payload", { status: 400 });
  }
  if (!verifyBeamSignature(rawBody, request.headers.get("x-beam-signature"), encodedHmacKey)) {
    return new Response("Invalid Beam signature", { status: 401 });
  }

  let payload: BeamPayload;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidJsonBodyError();
    }
    payload = parsed as BeamPayload;
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  if (payload.merchantId !== merchantId) {
    return new Response("Invalid Beam merchant", { status: 401 });
  }

  const event = request.headers.get("x-beam-event") ?? "";
  let result: ProcessingResult;
  if (event === "charge.succeeded") {
    const details = successfulPaymentDetails(payload);
    if (!details) return jsonNoStore({ ok: true, processed: false });
    result = await processSuccessfulCharge(details);
  } else if (event === "charge.failed") {
    if (
      payload.status !== "FAILED" ||
      typeof payload.referenceId !== "string" ||
      typeof payload.chargeId !== "string"
    ) {
      return jsonNoStore({ ok: true, processed: false });
    }
    result = await processFailedCharge(payload.referenceId, payload.chargeId);
  } else {
    // This application creates Charge API records only. Payment Link events are
    // deliberately ignored so an unrelated merchant-side payment link cannot
    // confirm a Pattani FC booking by choosing a similar reference.
    return jsonNoStore({ ok: true, processed: false });
  }

  if (result.outcome === "CONFIRMED") {
    revalidatePaymentViews(result.kind, result.code);
  }
  return jsonNoStore({
    ok: true,
    processed: result.outcome !== "IGNORED",
    reviewRequired: result.outcome === "REVIEW_REQUIRED",
  });
}

async function processSuccessfulCharge(details: PaymentDetails): Promise<ProcessingResult> {
  const reference = parseBeamPaymentReference(details.referenceId);
  if (!reference) return { outcome: "IGNORED", reason: "unsupported_reference" };

  const preliminary = await prisma.beamPayment.findUnique({
    where: { referenceId: details.referenceId },
    select: {
      id: true,
      bookingId: true,
      seasonPassOrderId: true,
      seasonPassPurchaseId: true,
      referenceId: true,
      chargeId: true,
      amount: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  if (!preliminary) return { outcome: "IGNORED", reason: "payment_not_found" };

  return prisma.$transaction(async (tx) => {
    await acquirePaymentTargetLock(tx, preliminary);
    const rows = await tx.$queryRaw<BeamPaymentRow[]>(Prisma.sql`
      SELECT "id", "bookingId", "seasonPassOrderId", "seasonPassPurchaseId",
             "referenceId", "chargeId", "amount", "status", "createdAt", "expiresAt"
      FROM "BeamPayment" WHERE "id" = ${preliminary.id} FOR UPDATE
    `);
    const payment = rows[0];
    if (!payment) return { outcome: "IGNORED", reason: "payment_deleted" } as const;

    const envelopeError = details.providerEnvelopeError ?? paymentEnvelopeError({
      storedAmount: payment.amount,
      receivedAmount: details.amount ?? Number.NaN,
      storedProviderId: payment.chargeId,
      receivedProviderId: details.chargeId,
      targetCount: paymentTargetCount(payment),
    });
    if (envelopeError) {
      return markBeamReview(tx, payment, details.chargeId, envelopeError);
    }
    const providerOwner = await tx.beamPayment.findUnique({
      where: { chargeId: details.chargeId },
      select: { id: true },
    });
    if (providerOwner && providerOwner.id !== payment.id) {
      return markBeamReview(tx, payment, details.chargeId, "provider_id_owned_by_other_payment");
    }
    const timestampError = paymentTimestampError({
      paidAt: details.paidAt!,
      paymentCreatedAt: payment.createdAt,
      paymentExpiresAt: payment.expiresAt,
    });
    if (timestampError) {
      return markBeamReview(tx, payment, details.chargeId, timestampError);
    }
    if (payment.status === PAYMENT_SUCCESS_STATUS) return { outcome: "DUPLICATE" } as const;
    if (payment.status === PAYMENT_REVIEW_STATUS) {
      return { outcome: "REVIEW_REQUIRED", reason: "payment_already_in_review" } as const;
    }
    if (!paymentCanAutomaticallySucceed(payment.status)) {
      return markBeamReview(tx, payment, details.chargeId, `invalid_source_status_${payment.status}`);
    }

    const confirmation = await confirmStoredPaymentTarget(tx, payment, {
      reference,
      paidAt: details.paidAt!,
      paymentMethod: details.paymentMethod,
    });
    if (confirmation.outcome === "REVIEW_REQUIRED") {
      return markBeamReview(tx, payment, details.chargeId, confirmation.reason);
    }

    const succeeded = await tx.beamPayment.updateMany({
      where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: PAYMENT_SUCCESS_STATUS, chargeId: details.chargeId },
    });
    if (succeeded.count !== 1) throw new Error("BEAM_PAYMENT_STATE_CHANGED");
    return {
      outcome: "CONFIRMED",
      kind: confirmation.kind,
      code: confirmation.code,
    } as const;
  });
}

async function processFailedCharge(
  referenceId: string,
  chargeId: string,
): Promise<ProcessingResult> {
  const reference = parseBeamPaymentReference(referenceId);
  if (!reference) return { outcome: "IGNORED", reason: "unsupported_reference" };
  const preliminary = await prisma.beamPayment.findUnique({
    where: { referenceId },
    select: {
      id: true,
      bookingId: true,
      seasonPassOrderId: true,
      seasonPassPurchaseId: true,
      referenceId: true,
      chargeId: true,
      amount: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  if (!preliminary) return { outcome: "IGNORED", reason: "payment_not_found" };

  return prisma.$transaction(async (tx) => {
    await acquirePaymentTargetLock(tx, preliminary);
    const rows = await tx.$queryRaw<BeamPaymentRow[]>(Prisma.sql`
      SELECT "id", "bookingId", "seasonPassOrderId", "seasonPassPurchaseId",
             "referenceId", "chargeId", "amount", "status", "createdAt", "expiresAt"
      FROM "BeamPayment" WHERE "id" = ${preliminary.id} FOR UPDATE
    `);
    const payment = rows[0];
    if (!payment) return { outcome: "IGNORED", reason: "payment_deleted" } as const;
    if (paymentTargetCount(payment) !== 1) {
      return markBeamReview(tx, payment, chargeId, "invalid_payment_target");
    }
    if (payment.chargeId && payment.chargeId !== chargeId) {
      return markBeamReview(tx, payment, chargeId, "provider_id_mismatch");
    }
    const providerOwner = await tx.beamPayment.findUnique({
      where: { chargeId },
      select: { id: true },
    });
    if (providerOwner && providerOwner.id !== payment.id) {
      return markBeamReview(tx, payment, chargeId, "provider_id_owned_by_other_payment");
    }
    const nextStatus = paymentStatusAfterFailure(payment.status);
    if (nextStatus === payment.status) {
      if (payment.status === PAYMENT_SUCCESS_STATUS) return { outcome: "DUPLICATE" } as const;
      if (payment.status === PAYMENT_REVIEW_STATUS) {
        return { outcome: "REVIEW_REQUIRED", reason: "payment_already_in_review" } as const;
      }
      return { outcome: "FAILED_RECORDED" } as const;
    }
    await tx.beamPayment.update({
      where: { id: payment.id },
      data: { status: nextStatus, ...(payment.chargeId ? {} : { chargeId }) },
    });
    return { outcome: "FAILED_RECORDED" } as const;
  });
}

async function markBeamReview(
  tx: Prisma.TransactionClient,
  payment: BeamPaymentRow,
  chargeId: string,
  reason: string,
): Promise<ProcessingResult> {
  console.warn("Beam payment requires manual review", {
    paymentRecordId: payment.id,
    providerChargeId: chargeId,
    previousStatus: payment.status,
    reason,
  });
  if (payment.status !== PAYMENT_SUCCESS_STATUS) {
    const providerOwner = payment.chargeId
      ? null
      : await tx.beamPayment.findUnique({
          where: { chargeId },
          select: { id: true },
        });
    await tx.beamPayment.update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_REVIEW_STATUS,
        ...(!payment.chargeId && (!providerOwner || providerOwner.id === payment.id)
          ? { chargeId }
          : {}),
      },
    });
  }
  return { outcome: "REVIEW_REQUIRED", reason };
}
