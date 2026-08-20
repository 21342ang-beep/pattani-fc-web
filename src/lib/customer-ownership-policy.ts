/**
 * Legacy email claiming is guest-only. A record with customerId already has
 * an authoritative owner and email must never override it.
 */
export function guestEmailOwnershipClause(email: string) {
  return {
    customerId: null,
    customerEmail: {
      equals: email,
      mode: "insensitive" as const,
    },
  };
}
