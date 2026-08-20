import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  isCustomerSessionCurrent,
  readCustomerSession,
} from "@/lib/customer-session";

/**
 * Verifies the signed cookie against current database security state. Use this
 * for optional-member flows too; a raw, valid JWT may have been revoked after
 * a password reset or an administrator credential change.
 */
export const getOptionalCustomer = cache(async () => {
  const session = await readCustomerSession();
  if (!session) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      name: true,
      phone: true,
      phoneVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      authVersion: true,
    },
  });

  if (!customer || !isCustomerSessionCurrent(session, customer.authVersion)) {
    return null;
  }
  return customer;
});

export const verifyCustomer = cache(async () => {
  const customer = await getOptionalCustomer();
  if (!customer) redirect("/member/login?reauth=1");
  return customer;
});
