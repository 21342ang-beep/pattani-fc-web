export type PhoneChangeStepUp =
  | "not-required"
  | "blocked-social-only"
  | "password-required"
  | "verify-password";

/**
 * Compare phone ownership using the same domestic representation accepted by
 * the member OTP flows. Formatting-only edits must not revoke verification or
 * trigger a credential check.
 */
export function normalizeProfilePhone(
  phone: string | null | undefined,
): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0066") && digits.length === 13) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith("66") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function isProfilePhoneChanged(
  currentPhone: string | null | undefined,
  nextPhone: string | null | undefined,
): boolean {
  return normalizeProfilePhone(currentPhone) !== normalizeProfilePhone(nextPhone);
}

/**
 * A long-lived member cookie is not sufficient proof for changing the phone
 * used by login, recovery and ticket ownership. Password accounts must step up;
 * social-only accounts fail closed until a password is established.
 */
export function getPhoneChangeStepUp(input: {
  currentPhone: string | null | undefined;
  nextPhone: string | null | undefined;
  hasPassword: boolean;
  currentPassword: unknown;
}): PhoneChangeStepUp {
  if (!isProfilePhoneChanged(input.currentPhone, input.nextPhone)) {
    return "not-required";
  }
  if (!input.hasPassword) return "blocked-social-only";
  return typeof input.currentPassword === "string" && input.currentPassword.length > 0
    ? "verify-password"
    : "password-required";
}
