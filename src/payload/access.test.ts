import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canManageCmsContent,
  canManageCmsFinance,
  cmsUserSelfScope,
  getCmsRole,
  hideFromNonContentManagers,
  hideFromNonFinanceManagers,
  hideFromNonSuperAdmins,
  isCmsSuperAdmin,
} from "./access";

const superAdmin = { id: 1, role: "super-admin" };
const editor = { id: 2, role: "editor" };
const accountant = { id: 3, role: "accountant" };

test("accepts only known CMS roles", () => {
  assert.equal(getCmsRole(superAdmin), "super-admin");
  assert.equal(getCmsRole(editor), "editor");
  assert.equal(getCmsRole(accountant), "accountant");
  assert.equal(getCmsRole({ id: 4, role: "owner" }), null);
  assert.equal(getCmsRole(null), null);
});

test("separates content and finance managers", () => {
  assert.equal(isCmsSuperAdmin(superAdmin), true);
  assert.equal(canManageCmsContent(superAdmin), true);
  assert.equal(canManageCmsFinance(superAdmin), true);

  assert.equal(canManageCmsContent(editor), true);
  assert.equal(canManageCmsFinance(editor), false);

  assert.equal(canManageCmsContent(accountant), false);
  assert.equal(canManageCmsFinance(accountant), true);
});

test("limits non-super-admin user access to the current CMS account", () => {
  assert.equal(cmsUserSelfScope(superAdmin), true);
  assert.deepEqual(cmsUserSelfScope(editor), { id: { equals: 2 } });
  assert.equal(cmsUserSelfScope({ role: "editor" }), false);
  assert.equal(cmsUserSelfScope(null), false);
});

test("hides collections from roles that cannot manage them", () => {
  assert.equal(hideFromNonSuperAdmins({ user: superAdmin }), false);
  assert.equal(hideFromNonSuperAdmins({ user: editor }), true);

  assert.equal(hideFromNonContentManagers({ user: editor }), false);
  assert.equal(hideFromNonContentManagers({ user: accountant }), true);

  assert.equal(hideFromNonFinanceManagers({ user: accountant }), false);
  assert.equal(hideFromNonFinanceManagers({ user: editor }), true);
});
