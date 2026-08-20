import assert from "node:assert/strict";
import test from "node:test";
import {
  SEASON_PAYMENT_WEBHOOK_GRACE_MS,
  seasonPaymentGraceCutoff,
  seasonPaymentGraceEndsAt,
} from "./season-payment-grace";

test("season payments retain inventory while an on-time webhook reconciles", () => {
  const deadline = new Date("2026-08-20T06:00:00.000Z");
  assert.equal(SEASON_PAYMENT_WEBHOOK_GRACE_MS, 120_000);
  assert.equal(
    seasonPaymentGraceEndsAt(deadline).toISOString(),
    "2026-08-20T06:02:00.000Z",
  );
  assert.equal(
    seasonPaymentGraceCutoff(new Date("2026-08-20T06:02:00.000Z")).toISOString(),
    deadline.toISOString(),
  );
});
