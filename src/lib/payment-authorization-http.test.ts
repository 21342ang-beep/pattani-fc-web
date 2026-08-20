import assert from "node:assert/strict";
import test from "node:test";
import { paymentTargetNotFound } from "./payment-http";

test("non-owner payment responses are generic no-store 404s", async () => {
  const response = paymentTargetNotFound();
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "ไม่พบรายการชำระเงิน" });
});
