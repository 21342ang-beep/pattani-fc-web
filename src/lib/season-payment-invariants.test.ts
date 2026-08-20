import assert from "node:assert/strict";
import test from "node:test";
import { isStandaloneSeasonOrder } from "./season-payment-invariants";

test("only orders without a purchase parent can use standalone payment", () => {
  assert.equal(isStandaloneSeasonOrder({ purchaseId: null }), true);
  assert.equal(isStandaloneSeasonOrder({ purchaseId: "purchase-1" }), false);
});
