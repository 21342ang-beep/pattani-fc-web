import assert from "node:assert/strict";
import test from "node:test";
import {
  canChangeAdminRole,
  canDeleteAdminRole,
} from "./admin-user-policy";

test("web actions never demote or delete a super-admin", () => {
  assert.equal(canChangeAdminRole("SUPER_ADMIN", "ADMIN"), false);
  assert.equal(canDeleteAdminRole("SUPER_ADMIN"), false);
});

test("two concurrent super-admin mutations are both denied by policy", () => {
  const attempts = [
    canChangeAdminRole("SUPER_ADMIN", "ADMIN"),
    canDeleteAdminRole("SUPER_ADMIN"),
  ];
  assert.deepEqual(attempts, [false, false]);
});

test("ordinary administrators remain manageable", () => {
  assert.equal(canChangeAdminRole("ADMIN", "SUPER_ADMIN"), true);
  assert.equal(canChangeAdminRole("ADMIN", "ADMIN"), true);
  assert.equal(canDeleteAdminRole("ADMIN"), true);
});
