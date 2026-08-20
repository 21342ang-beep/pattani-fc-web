import assert from "node:assert/strict";
import test from "node:test";
import {
  isGateScanTimestampAcceptable,
  planGateAdmissionSync,
  resolveGateWriteOutcome,
} from "./gate-sync-policy";

test("gate sync accepts only the transaction that updated the row", () => {
  assert.deepEqual(resolveGateWriteOutcome(1, null), { kind: "accepted" });
});

test("a losing concurrent gate sync is returned as a conflict", () => {
  const scannedAt = new Date("2026-08-20T12:00:00.000Z");
  assert.deepEqual(resolveGateWriteOutcome(0, scannedAt), {
    kind: "conflict",
    serverScannedAt: scannedAt,
  });
  assert.deepEqual(resolveGateWriteOutcome(0, null), { kind: "unknown" });
});

test("one offline booking can consume all five admission slots", () => {
  const plan = planGateAdmissionSync(
    5,
    0,
    Array.from({ length: 5 }, (_, index) => ({
      scanId: String(index + 1).padStart(32, "0"),
      admissionNumber: index + 1,
    })),
  );

  assert.equal(plan.accepted.length, 5);
  assert.deepEqual(plan.duplicates, []);
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.finalCount, 5);
});

test("serialized gate sync makes concurrent copies idempotent and never exceeds quantity", () => {
  const gateOne = Array.from({ length: 5 }, (_, index) => ({
    scanId: `a${String(index + 1).padStart(31, "0")}`,
    admissionNumber: index + 1,
  }));
  const gateTwo = Array.from({ length: 5 }, (_, index) => ({
    scanId: `b${String(index + 1).padStart(31, "0")}`,
    admissionNumber: index + 1,
  }));

  const first = planGateAdmissionSync(5, 0, gateOne);
  const second = planGateAdmissionSync(5, first.finalCount, gateTwo);

  assert.equal(first.accepted.length, 5);
  assert.equal(second.accepted.length, 0);
  assert.equal(second.duplicates.length, 5);
  assert.equal(second.finalCount, 5);
});

test("retries, duplicate records, gaps, and over-capacity slots do not spend another use", () => {
  const retryId = "c".repeat(32);
  const gapId = "d".repeat(32);
  const overId = "e".repeat(32);
  const plan = planGateAdmissionSync(5, 2, [
    { scanId: retryId, admissionNumber: 2 },
    { scanId: retryId, admissionNumber: 2 },
    { scanId: gapId, admissionNumber: 4 },
    { scanId: overId, admissionNumber: 6 },
  ]);

  assert.deepEqual(plan.accepted, []);
  assert.deepEqual(plan.duplicates, [retryId, retryId]);
  assert.deepEqual(plan.conflicts.sort(), [gapId, overId].sort());
  assert.equal(plan.finalCount, 2);
});

test("offline timestamps are bounded by the authenticated cache lifetime", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");
  assert.equal(
    isGateScanTimestampAcceptable(new Date("2026-08-20T04:00:00.000Z"), now),
    true,
  );
  assert.equal(
    isGateScanTimestampAcceptable(new Date("2026-08-20T02:59:59.999Z"), now),
    false,
  );
  assert.equal(
    isGateScanTimestampAcceptable(new Date("2026-08-20T12:05:00.001Z"), now),
    false,
  );
});
