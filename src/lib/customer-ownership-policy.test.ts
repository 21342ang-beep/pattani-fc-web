import assert from "node:assert/strict";
import test from "node:test";
import { guestEmailOwnershipClause } from "./customer-ownership-policy";

test("email ownership fallback is restricted to unlinked guest records", () => {
  assert.deepEqual(guestEmailOwnershipClause("member@example.com"), {
    customerId: null,
    customerEmail: {
      equals: "member@example.com",
      mode: "insensitive",
    },
  });
});
