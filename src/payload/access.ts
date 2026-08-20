import type { Access, AccessResult, FieldAccess } from "payload";

export const CMS_ROLES = ["super-admin", "editor", "accountant"] as const;

export type CmsRole = (typeof CMS_ROLES)[number];

type CmsUserLike = {
  id?: unknown;
  role?: unknown;
} | null | undefined;

function cmsUser(value: unknown): CmsUserLike {
  return value && typeof value === "object" ? value as CmsUserLike : null;
}

export function getCmsRole(user: unknown): CmsRole | null {
  const role = cmsUser(user)?.role;
  return typeof role === "string" && CMS_ROLES.includes(role as CmsRole)
    ? role as CmsRole
    : null;
}

export function isCmsSuperAdmin(user: unknown): boolean {
  return getCmsRole(user) === "super-admin";
}

export function canManageCmsContent(user: unknown): boolean {
  const role = getCmsRole(user);
  return role === "super-admin" || role === "editor";
}

export function canManageCmsFinance(user: unknown): boolean {
  const role = getCmsRole(user);
  return role === "super-admin" || role === "accountant";
}

export function cmsUserSelfScope(user: unknown): AccessResult {
  if (isCmsSuperAdmin(user)) return true;
  const id = cmsUser(user)?.id;
  if (typeof id !== "string" && typeof id !== "number") return false;
  return { id: { equals: id } };
}

export const publicRead: Access = () => true;
export const publishedContentRead: Access = ({ req }) =>
  canManageCmsContent(req.user) ? true : { status: { equals: "published" } };
export const activeContentRead: Access = ({ req }) =>
  canManageCmsContent(req.user) ? true : { active: { equals: true } };
export const superAdminOnly: Access = ({ req }) => isCmsSuperAdmin(req.user);
export const superAdminOrSelf: Access = ({ req }) => cmsUserSelfScope(req.user);
export const contentManagersOnly: Access = ({ req }) => canManageCmsContent(req.user);
export const financeManagersOnly: Access = ({ req }) => canManageCmsFinance(req.user);

export const superAdminFieldOnly: FieldAccess = ({ req }) =>
  isCmsSuperAdmin(req.user);

export function hideFromNonSuperAdmins({ user }: { user: unknown }): boolean {
  return !isCmsSuperAdmin(user);
}

export function hideFromNonContentManagers({ user }: { user: unknown }): boolean {
  return !canManageCmsContent(user);
}

export function hideFromNonFinanceManagers({ user }: { user: unknown }): boolean {
  return !canManageCmsFinance(user);
}
