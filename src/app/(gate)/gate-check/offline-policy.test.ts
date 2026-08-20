import assert from "node:assert/strict";
import test from "node:test";
import {
  GATE_OFFLINE_MAX_TTL_MS,
  clampGateOfflineExpiry,
  decideGateStorageTransition,
  isGateOfflineSessionValid,
  isGateRecordUsable,
  nextGateAdmissionNumber,
  type GateOfflineSession,
} from "./offline-policy";

const now = 1_800_000_000_000;
const session: GateOfflineSession = {
  id: "a".repeat(64),
  expiresAt: now + 60_000,
};

test("offline expiry never outlives the admin session or eight-hour cap", () => {
  assert.equal(clampGateOfflineExpiry(now + 60_000, now), now + 60_000);
  assert.equal(
    clampGateOfflineExpiry(now + GATE_OFFLINE_MAX_TTL_MS * 2, now),
    now + GATE_OFFLINE_MAX_TTL_MS,
  );
});

test("offline sessions require an opaque id and a future expiry", () => {
  assert.equal(isGateOfflineSessionValid(session, now), true);
  assert.equal(
    isGateOfflineSessionValid({ ...session, id: "admin-user-id" }, now),
    false,
  );
  assert.equal(
    isGateOfflineSessionValid({ ...session, expiresAt: now }, now),
    false,
  );
});

test("cached gate records are usable only by their exact live session", () => {
  assert.equal(
    isGateRecordUsable(
      { sessionId: session.id, expiresAt: now + 30_000 },
      session,
      now,
    ),
    true,
  );
  assert.equal(
    isGateRecordUsable(
      { sessionId: "b".repeat(64), expiresAt: now + 30_000 },
      session,
      now,
    ),
    false,
  );
  assert.equal(
    isGateRecordUsable(
      { sessionId: session.id, expiresAt: now - 1 },
      session,
      now,
    ),
    false,
  );
});

test("legacy and different-session databases are always cleared", () => {
  assert.equal(decideGateStorageTransition(undefined, session, now), "clear-legacy");
  assert.equal(
    decideGateStorageTransition(
      { sessionId: "b".repeat(64), expiresAt: now + 30_000 },
      session,
      now,
    ),
    "clear-session",
  );
  assert.equal(
    decideGateStorageTransition(
      { sessionId: session.id, expiresAt: now + 30_000 },
      session,
      now,
    ),
    "reuse",
  );
});

test("one offline booking allocates five distinct admission slots then stops", () => {
  let localFloor = 0;
  const slots: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const next = nextGateAdmissionNumber(0, localFloor, 5);
    assert.notEqual(next, null);
    slots.push(next!);
    localFloor = next!;
  }

  assert.deepEqual(slots, [1, 2, 3, 4, 5]);
  assert.equal(nextGateAdmissionNumber(0, localFloor, 5), null);
});

test("local admission allocation never goes behind the server or local floor", () => {
  assert.equal(nextGateAdmissionNumber(3, 1, 5), 4);
  assert.equal(nextGateAdmissionNumber(1, 3, 5), 4);
  assert.equal(nextGateAdmissionNumber(5, 3, 5), null);
  assert.equal(nextGateAdmissionNumber(-1, 0, 5), null);
});
