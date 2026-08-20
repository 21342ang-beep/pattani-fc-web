import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Returns at most two verified owners of a normalized email. A single row is
 * required before an unlinked guest purchase may be claimed by email.
 */
export async function getVerifiedEmailOwnerIds(email: string): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Customer"
    WHERE "emailVerifiedAt" IS NOT NULL
      AND lower(trim("email")) = ${normalized}
    ORDER BY "emailVerifiedAt" ASC, "id" ASC
    LIMIT 2
  `;
  return rows.map(({ id }) => id);
}
