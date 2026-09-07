import assert from "node:assert/strict";
import test from "node:test";
import { getBulkScanDeficit } from "./booking-bulk-scan-policy";

test("adds every admission when a confirmed booking has no scans", () => {
  assert.equal(getBulkScanDeficit({ status: "CONFIRMED", quantity: 3, scanCount: 0 }), 3);
});

test("adds only the missing admissions when a booking was partially scanned", () => {
  assert.equal(getBulkScanDeficit({ status: "CONFIRMED", quantity: 3, scanCount: 1 }), 2);
});

test("is idempotent when a confirmed booking is already complete or over-counted", () => {
  assert.equal(getBulkScanDeficit({ status: "CONFIRMED", quantity: 2, scanCount: 2 }), 0);
  assert.equal(getBulkScanDeficit({ status: "CONFIRMED", quantity: 2, scanCount: 3 }), 0);
});

test("never scans pending, cancelled, or refunded bookings", () => {
  for (const status of ["PENDING", "CANCELLED", "REFUNDED"]) {
    assert.equal(getBulkScanDeficit({ status, quantity: 4, scanCount: 0 }), 0);
  }
});

test("never creates scans for invalid non-positive quantities", () => {
  assert.equal(getBulkScanDeficit({ status: "CONFIRMED", quantity: 0, scanCount: 0 }), 0);
  assert.equal(getBulkScanDeficit({ status: "CONFIRMED", quantity: -2, scanCount: 0 }), 0);
});
