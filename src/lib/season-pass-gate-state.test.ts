import assert from "node:assert/strict";
import test from "node:test";
import { orderSeasonPassBarcodeLockIds } from "./season-pass-gate-state";

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
