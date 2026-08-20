export const SEASON_PAYMENT_WEBHOOK_GRACE_MS = 2 * 60 * 1000;

export function seasonPaymentGraceCutoff(now = new Date()): Date {
  return new Date(now.getTime() - SEASON_PAYMENT_WEBHOOK_GRACE_MS);
}

export function seasonPaymentGraceEndsAt(paymentExpiresAt: Date): Date {
  return new Date(paymentExpiresAt.getTime() + SEASON_PAYMENT_WEBHOOK_GRACE_MS);
}
