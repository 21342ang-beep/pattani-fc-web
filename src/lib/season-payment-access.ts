import "server-only";

import { getOptionalCustomer } from "@/lib/customer-dal";
import { getVerifiedEmailOwnerIds } from "@/lib/customer-email-ownership";
import {
  seasonPaymentOwnedByCustomer,
  type SeasonPaymentOwner,
} from "@/lib/season-payment-access-policy";

export async function hasSeasonPaymentAccess(
  target: SeasonPaymentOwner,
): Promise<boolean> {
  const customer = await getOptionalCustomer();
  if (!customer) return false;
  const verifiedEmailOwnerIds =
    target.customerId === null && target.customerEmail && customer.emailVerifiedAt
      ? await getVerifiedEmailOwnerIds(target.customerEmail)
      : [];
  return seasonPaymentOwnedByCustomer(target, customer, verifiedEmailOwnerIds);
}
