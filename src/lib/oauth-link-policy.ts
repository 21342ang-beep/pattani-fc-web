/**
 * A provider account may only be attached automatically when the existing
 * customer already proved ownership of that same email address. A matching
 * but unverified address can have been pre-registered by an attacker.
 */
export function canAutoLinkOAuthCustomer(
  emailVerifiedAt: Date | null,
): boolean {
  return emailVerifiedAt instanceof Date && !Number.isNaN(emailVerifiedAt.getTime());
}
