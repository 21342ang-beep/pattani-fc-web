import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_AUTH_CHALLENGE_CLEANUP_BATCH_SIZE,
  customerAuthChallengeShouldBeDeleted,
  shouldStartCustomerAuthChallengeCleanup,
} from "./customer-auth-challenge-policy";

test("auth challenge cleanup removes expired/completed rows and retains live rows", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");
  assert.equal(
    customerAuthChallengeShouldBeDeleted({
      expiresAt: new Date("2026-08-20T11:59:59.000Z"),
      now,
    }),
    true,
  );
  assert.equal(
    customerAuthChallengeShouldBeDeleted({
      expiresAt: new Date("2026-08-20T12:10:00.000Z"),
      completedAt: new Date("2026-08-20T11:59:00.000Z"),
      now,
    }),
    true,
  );
  assert.equal(
    customerAuthChallengeShouldBeDeleted({
      expiresAt: new Date("2026-08-20T12:10:00.000Z"),
      completedAt: null,
      now,
    }),
    false,
  );
  assert.ok(CUSTOMER_AUTH_CHALLENGE_CLEANUP_BATCH_SIZE <= 1_000);
});

test("auth challenge cleanup starts only in the Node server runtime", () => {
  assert.equal(
    shouldStartCustomerAuthChallengeCleanup({
      runtime: "nodejs",
      phase: "phase-production-build",
    }),
    false,
  );
  assert.equal(
    shouldStartCustomerAuthChallengeCleanup({
      runtime: "edge",
      phase: undefined,
    }),
    false,
  );
  assert.equal(
    shouldStartCustomerAuthChallengeCleanup({
      runtime: "nodejs",
      phase: undefined,
    }),
    true,
  );
});
