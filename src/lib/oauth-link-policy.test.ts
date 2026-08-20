import assert from "node:assert/strict";
import test from "node:test";
import { canAutoLinkOAuthCustomer } from "./oauth-link-policy";

test("OAuth auto-link refuses an existing customer with an unverified email", () => {
  assert.equal(canAutoLinkOAuthCustomer(null), false);
});

test("OAuth auto-link accepts an existing customer with a verified email", () => {
  assert.equal(
    canAutoLinkOAuthCustomer(new Date("2026-08-20T00:00:00.000Z")),
    true,
  );
});
