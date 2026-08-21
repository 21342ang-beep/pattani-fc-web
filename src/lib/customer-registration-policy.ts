export const CUSTOMER_REGISTRATION_OTP_TTL_MS = 10 * 60_000;
export const CUSTOMER_REGISTRATION_MAX_OTP_ATTEMPTS = 5;
export const CUSTOMER_INTERNAL_EMAIL_DOMAIN = "accounts.pattanifc.local";

export function resolveRegistrationAccountEmail(
  submittedEmail: string | null | undefined,
  generatedId: string,
): string {
  const normalizedEmail = (submittedEmail ?? "").trim().toLowerCase();
  return normalizedEmail || `member-${generatedId}@${CUSTOMER_INTERNAL_EMAIL_DOMAIN}`;
}

export function normalizeRegistrationPhone(
  phone: string | null | undefined,
): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  const domestic = digits.startsWith("0066") && digits.length === 13
    ? `0${digits.slice(4)}`
    : digits.startsWith("66") && digits.length === 11
      ? `0${digits.slice(2)}`
      : digits;
  return /^0[689]\d{8}$/.test(domestic) ? domestic : null;
}

export type PasswordRegistrationSecurityPlan = {
  createCustomer: boolean;
  issueCustomerSession: boolean;
  trustPhoneForRecovery: boolean;
  phoneVerifiedAt: Date | null;
};

/**
 * The password-registration security boundary in one auditable decision. A
 * submitted form or issued SMS never activates an account; only a live
 * challenge plus a provider-verified OTP does.
 */
export function passwordRegistrationSecurityPlan(input: {
  challengeActive: boolean;
  activationEligible: boolean;
  otpVerified: boolean;
  verifiedAt: Date;
}): PasswordRegistrationSecurityPlan {
  if (
    !input.challengeActive ||
    !input.activationEligible ||
    !input.otpVerified
  ) {
    return {
      createCustomer: false,
      issueCustomerSession: false,
      trustPhoneForRecovery: false,
      phoneVerifiedAt: null,
    };
  }
  return {
    createCustomer: true,
    issueCustomerSession: true,
    trustPhoneForRecovery: true,
    phoneVerifiedAt: input.verifiedAt,
  };
}

export function registrationChallengeActivationEligible(input: {
  emailAlreadyRegistered: boolean;
  verifiedPhoneOwnerCount: number;
}): boolean {
  return (
    !input.emailAlreadyRegistered && input.verifiedPhoneOwnerCount === 0
  );
}

export function uniqueVerifiedPhoneRecoveryOwner(
  verifiedOwnerIds: readonly string[],
): string | null {
  return verifiedOwnerIds.length === 1 ? verifiedOwnerIds[0] : null;
}

export function passwordResetShouldRequestProvider(
  ownerCustomerId: string | null,
): boolean {
  return ownerCustomerId !== null;
}

export function passwordResetPersistedChallenge(input: {
  ownerCustomerId: string | null;
  issuedProviderToken: string | null;
  decoyProviderToken: string;
}): { customerId: string | null; providerToken: string } {
  if (input.ownerCustomerId && input.issuedProviderToken) {
    return {
      customerId: input.ownerCustomerId,
      providerToken: input.issuedProviderToken,
    };
  }
  return { customerId: null, providerToken: input.decoyProviderToken };
}

export function passwordResetCommitAllowed(input: {
  challengeStillPresent: boolean;
  challengeCustomerId: string | null;
  expectedCustomerId: string | null;
}): boolean {
  return (
    input.challengeStillPresent &&
    input.expectedCustomerId !== null &&
    input.challengeCustomerId === input.expectedCustomerId
  );
}

export const PASSWORD_RECOVERY_PROVIDER_TIMEOUT_MS = 1_800;
export const PASSWORD_RECOVERY_RESPONSE_FLOOR_MS = 2_200;
export const PASSWORD_RECOVERY_RESPONSE_JITTER_MS = 300;

export function passwordRecoveryResponseTargetMs(randomUnit: number): number {
  const bounded = Number.isFinite(randomUnit)
    ? Math.min(0.999999, Math.max(0, randomUnit))
    : 0;
  return (
    PASSWORD_RECOVERY_RESPONSE_FLOOR_MS +
    Math.floor(bounded * (PASSWORD_RECOVERY_RESPONSE_JITTER_MS + 1))
  );
}

export function remainingRecoveryResponseDelayMs(input: {
  startedAtMs: number;
  nowMs: number;
  targetMs: number;
}): number {
  return Math.max(0, Math.ceil(input.targetMs - (input.nowMs - input.startedAtMs)));
}
