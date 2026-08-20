export type SeasonPaymentOwner = {
  customerId: string | null;
  customerEmail: string | null;
};

export type SeasonPaymentCustomer = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
};

export function seasonPaymentOwnedByCustomer(
  target: SeasonPaymentOwner,
  customer: SeasonPaymentCustomer | null,
  verifiedEmailOwnerIds: readonly string[] = [],
): boolean {
  if (!customer) return false;
  if (target.customerId !== null) return target.customerId === customer.id;

  const targetEmail = target.customerEmail?.trim().toLowerCase() ?? "";
  if (
    !targetEmail ||
    !customer.emailVerifiedAt ||
    targetEmail !== customer.email.trim().toLowerCase()
  ) {
    return false;
  }
  return verifiedEmailOwnerIds.length === 1 && verifiedEmailOwnerIds[0] === customer.id;
}
