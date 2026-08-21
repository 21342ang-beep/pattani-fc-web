export const PAYMENT_REVIEW_STATUS = "REVIEW_REQUIRED" as const;
export const PAYMENT_SUCCESS_STATUS = "SUCCEEDED" as const;
export const PAYMENT_EVIDENCE_RETENTION_STATUSES = [
  PAYMENT_SUCCESS_STATUS,
  PAYMENT_REVIEW_STATUS,
] as const;

export const PAYMENT_TARGET_DELETION_SAFE_STATUSES = ["FAILED", "EXPIRED"] as const;
const PAYMENT_TARGET_DELETION_SAFE_STATUS_SET = new Set<string>(
  PAYMENT_TARGET_DELETION_SAFE_STATUSES,
);

const AUTOMATIC_SUCCESS_SOURCE_STATUSES = new Set(["INITIATED", "PENDING"]);
const AUTOMATIC_BOOKING_CONFIRMATION_STATUSES = new Set(["PENDING", "CANCELLED"]);

export function paymentCanAutomaticallySucceed(status: string): boolean {
  return AUTOMATIC_SUCCESS_SOURCE_STATUSES.has(status);
}

export function bookingCanAutomaticallyConfirm(status: string): boolean {
  return AUTOMATIC_BOOKING_CONFIRMATION_STATUSES.has(status);
}

export function paymentEvidenceMustBeRetained(status: string): boolean {
  return (PAYMENT_EVIDENCE_RETENTION_STATUSES as readonly string[]).includes(status);
}

export function paymentEvidenceAllowsTargetDeletion(status: string): boolean {
  return PAYMENT_TARGET_DELETION_SAFE_STATUS_SET.has(status);
}

export function paymentStatusAfterFailure(status: string): string {
  return paymentCanAutomaticallySucceed(status) ? "FAILED" : status;
}

export function paymentTargetCount(target: {
  bookingId: string | null;
  seasonPassOrderId: string | null;
  seasonPassPurchaseId: string | null;
}): number {
  return [target.bookingId, target.seasonPassOrderId, target.seasonPassPurchaseId]
    .filter((value) => value != null).length;
}

export function paymentEnvelopeError(input: {
  storedAmount: number;
  receivedAmount: number;
  storedProviderId: string | null;
  receivedProviderId: string;
  targetCount: number;
}): string | null {
  if (!Number.isSafeInteger(input.storedAmount) || input.storedAmount <= 0) {
    return "invalid_stored_amount";
  }
  if (!Number.isSafeInteger(input.receivedAmount) || input.receivedAmount <= 0) {
    return "invalid_provider_amount";
  }
  if (input.storedAmount !== input.receivedAmount) return "amount_mismatch";
  if (input.targetCount !== 1) return "invalid_payment_target";
  if (input.storedProviderId && input.storedProviderId !== input.receivedProviderId) {
    return "provider_id_mismatch";
  }
  return null;
}

export function paymentTimestampError(input: {
  paidAt: Date;
  paymentCreatedAt: Date;
  paymentExpiresAt: Date | null;
  now?: Date;
  allowedClockSkewMs?: number;
}): string | null {
  const now = input.now ?? new Date();
  const allowedClockSkewMs = input.allowedClockSkewMs ?? 5 * 60 * 1000;
  const paidAtMs = input.paidAt.getTime();
  if (!Number.isFinite(paidAtMs)) return "invalid_payment_timestamp";
  if (paidAtMs < input.paymentCreatedAt.getTime() - allowedClockSkewMs) {
    return "payment_timestamp_before_request";
  }
  if (paidAtMs > now.getTime() + allowedClockSkewMs) {
    return "payment_timestamp_in_future";
  }
  if (input.paymentExpiresAt && paidAtMs > input.paymentExpiresAt.getTime()) {
    return "provider_payment_late";
  }
  return null;
}

export function providerAmountToMinorUnits(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const scaled = amount * 100;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 1e-6) return null;
  return rounded;
}
