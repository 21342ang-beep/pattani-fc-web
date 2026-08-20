export async function register(): Promise<void> {
  const { shouldStartCustomerAuthChallengeCleanup } = await import(
    "@/lib/customer-auth-challenge-policy"
  );
  if (
    !shouldStartCustomerAuthChallengeCleanup({
      runtime: process.env.NEXT_RUNTIME,
      phase: process.env.NEXT_PHASE,
    })
  ) {
    return;
  }

  const { startCustomerAuthChallengeCleanup } = await import(
    "@/lib/customer-auth-challenge-cleanup"
  );
  startCustomerAuthChallengeCleanup();
}
