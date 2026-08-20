import assert from "node:assert/strict";
import test from "node:test";
import {
  getLegacyUpgradeTimes,
  hasValidLegacySessionTimes,
} from "./legacy-session-policy";

const now = 1_800_000_000;

test("legacy session requires exp, iat and matching expiresAt", () => {
  assert.equal(hasValidLegacySessionTimes({}, 3600, now), false);
  assert.equal(
    hasValidLegacySessionTimes(
      { iat: now - 60, exp: now + 60, expiresAt: (now + 60) * 1000 },
      3600,
      now,
    ),
    true,
  );
  assert.equal(
    hasValidLegacySessionTimes(
      { iat: now - 60, exp: now + 60, expiresAt: (now + 61) * 1000 },
      3600,
      now,
    ),
    false,
  );
});

test("legacy session rejects future issuance and excessive TTL", () => {
  assert.equal(
    hasValidLegacySessionTimes(
      { iat: now + 1, exp: now + 60, expiresAt: (now + 60) * 1000 },
      3600,
      now,
    ),
    false,
  );
  assert.equal(
    hasValidLegacySessionTimes(
      { iat: now - 1, exp: now + 3601, expiresAt: (now + 3601) * 1000 },
      3600,
      now,
    ),
    false,
  );
});

test("legacy upgrade preserves original iat and is capped by rollout cutoff", () => {
  const claims = {
    iat: now - 120,
    exp: now + 3600,
    expiresAt: (now + 3600) * 1000,
  };
  assert.deepEqual(
    getLegacyUpgradeTimes(claims, 7200, now + 300, now),
    { issuedAt: now - 120, expiration: now + 300 },
  );
});
