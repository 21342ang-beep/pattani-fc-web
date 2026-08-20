export const CUSTOMER_AUTH_CHALLENGE_CLEANUP_BATCH_SIZE = 250;

export function shouldStartCustomerAuthChallengeCleanup(input: {
  runtime: string | undefined;
  phase: string | undefined;
}): boolean {
  return (
    input.runtime === "nodejs" && input.phase !== "phase-production-build"
  );
}

export function customerAuthChallengeShouldBeDeleted(input: {
  expiresAt: Date;
  completedAt?: Date | null;
  now: Date;
}): boolean {
  return Boolean(input.completedAt) || input.expiresAt <= input.now;
}
