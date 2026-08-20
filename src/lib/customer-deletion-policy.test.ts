import assert from "node:assert/strict";
import test from "node:test";
import { hasRetainedCustomerHistory } from "./customer-deletion-policy";

test("customer hard-delete is allowed only when every retained history count is zero", () => {
  assert.equal(
    hasRetainedCustomerHistory({
      bookings: 0,
      seasonPassPurchases: 0,
      seasonPassOrders: 0,
    }),
    false,
  );
});

test("any booking or season-pass history blocks hard-delete regardless of status", () => {
  assert.equal(
    hasRetainedCustomerHistory({
      bookings: 1,
      seasonPassPurchases: 0,
      seasonPassOrders: 0,
    }),
    true,
  );
  assert.equal(
    hasRetainedCustomerHistory({
      bookings: 0,
      seasonPassPurchases: 1,
      seasonPassOrders: 0,
    }),
    true,
  );
  assert.equal(
    hasRetainedCustomerHistory({
      bookings: 0,
      seasonPassPurchases: 0,
      seasonPassOrders: 1,
    }),
    true,
  );
});
