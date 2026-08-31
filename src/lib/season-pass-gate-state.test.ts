import assert from "node:assert/strict";
import test from "node:test";
import {
  orderSeasonPassBarcodeLockIds,
  rotateSeasonPassGateCredential,
  secureSeasonPassGateAssignment,
} from "./season-pass-gate-state";

test("barcode row locks are unique and deterministic across opposite movers", () => {
  assert.deepEqual(
    orderSeasonPassBarcodeLockIds(["barcode-z", "barcode-a", "barcode-z"]),
    ["barcode-a", "barcode-z"],
  );
  assert.deepEqual(
    orderSeasonPassBarcodeLockIds(["barcode-a", "barcode-z"]),
    orderSeasonPassBarcodeLockIds(["barcode-z", "barcode-a"]),
  );
});

test("printed PFC26 cards accept their physical barcode after assignment", () => {
  for (const barcode of [
    "PFC26-4000-0001",
    "PFC26-2500-0386",
    "PFC26-2000-1000",
    "PFC26-1500-0800",
  ]) {
    assert.deepEqual(secureSeasonPassGateAssignment(barcode), {
      legacyGateAllowed: true,
    });
  }
});

test("non-printed formats remain SPG2-only and released cards disable PFC26", () => {
  assert.deepEqual(secureSeasonPassGateAssignment("SP-PREMIUM-1234ABCD"), {
    legacyGateAllowed: false,
  });
  assert.deepEqual(secureSeasonPassGateAssignment("PFC26-2000-001"), {
    legacyGateAllowed: false,
  });
  assert.equal(rotateSeasonPassGateCredential().legacyGateAllowed, false);
});
