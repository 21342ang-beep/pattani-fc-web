import type { Role } from "@prisma/client";

/**
 * Super-administrator removal is an operational recovery task, not a normal
 * web action. Forbidding it here eliminates the count-then-write race where two
 * concurrent requests could each remove the other remaining super-admin.
 */
export function canChangeAdminRole(targetRole: Role, nextRole: Role): boolean {
  return targetRole !== "SUPER_ADMIN" || nextRole === "SUPER_ADMIN";
}

export function canDeleteAdminRole(targetRole: Role): boolean {
  return targetRole !== "SUPER_ADMIN";
}
