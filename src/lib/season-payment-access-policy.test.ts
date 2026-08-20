import assert from "node:assert/strict";
import test from "node:test";
import { seasonPaymentOwnedByCustomer } from "./season-payment-access-policy";

const customer = {
  id: "customer-1",
  email: "owner@example.com",
  emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
};

test("season payment targets reject non-owners and logged-out callers", () => {
  assert.equal(seasonPaymentOwnedByCustomer({
    customerId: "customer-1",
    customerEmail: customer.email,
  }, null), false);
  assert.equal(seasonPaymentOwnedByCustomer({
    customerId: "customer-2",
    customerEmail: customer.email,
  }, customer), false);
});

test("legacy guest season targets require one unique verified email owner", () => {
  const target = { customerId: null, customerEmail: "OWNER@example.com" };
  assert.equal(seasonPaymentOwnedByCustomer(target, customer, []), false);
  assert.equal(seasonPaymentOwnedByCustomer(target, customer, ["customer-1", "customer-2"]), false);
  assert.equal(seasonPaymentOwnedByCustomer(target, customer, ["customer-1"]), true);
});
