import "server-only";

import { prisma } from "@/lib/prisma";
import { CUSTOMER_AUTH_CHALLENGE_CLEANUP_BATCH_SIZE } from "@/lib/customer-auth-challenge-policy";

const CLEANUP_INTERVAL_MS = 5 * 60_000;

type CleanupGlobal = typeof globalThis & {
  __pattaniCustomerAuthCleanupTimer?: ReturnType<typeof setInterval>;
  __pattaniCustomerAuthCleanupInFlight?: Promise<void>;
};

function cleanupErrorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error
    ? String(error.code).slice(0, 80)
    : "unknown";
}

/**
 * Remove only a bounded number of expired authentication challenges per run.
 * SKIP LOCKED keeps cleanup from waiting behind an in-flight OTP completion.
 */
export async function cleanupCustomerAuthChallenges(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      WITH doomed AS (
        SELECT "id" FROM "CustomerRegistrationChallenge"
        WHERE "expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          OR "completedAt" IS NOT NULL
        ORDER BY "expiresAt" ASC
        LIMIT ${CUSTOMER_AUTH_CHALLENGE_CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "CustomerRegistrationChallenge" challenge
      USING doomed
      WHERE challenge."id" = doomed."id"
    `;
    await tx.$executeRaw`
      WITH doomed AS (
        SELECT "id" FROM "CustomerPasswordResetOtp"
        WHERE "expiresAt" <= NOW()
        ORDER BY "expiresAt" ASC
        LIMIT ${CUSTOMER_AUTH_CHALLENGE_CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "CustomerPasswordResetOtp" challenge
      USING doomed
      WHERE challenge."id" = doomed."id"
    `;
  });
}

/** Start one shared, unref'ed cleanup loop per long-running Next.js process. */
export function startCustomerAuthChallengeCleanup(): void {
  const scope = globalThis as CleanupGlobal;
  if (scope.__pattaniCustomerAuthCleanupTimer) return;

  const runCleanup = () => {
    if (scope.__pattaniCustomerAuthCleanupInFlight) return;
    const cleanup = cleanupCustomerAuthChallenges()
      .catch((error) => {
        // Retry on the next scheduled run; never include challenge PII/tokens.
        console.error("Customer auth challenge cleanup failed", {
          code: cleanupErrorCode(error),
        });
      })
      .finally(() => {
        if (scope.__pattaniCustomerAuthCleanupInFlight === cleanup) {
          scope.__pattaniCustomerAuthCleanupInFlight = undefined;
        }
      });
    scope.__pattaniCustomerAuthCleanupInFlight = cleanup;
  };

  scope.__pattaniCustomerAuthCleanupTimer = setInterval(
    runCleanup,
    CLEANUP_INTERVAL_MS,
  );
  scope.__pattaniCustomerAuthCleanupTimer.unref?.();

  const startupCleanup = setTimeout(runCleanup, 1_000);
  startupCleanup.unref?.();
}
