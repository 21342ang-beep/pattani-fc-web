import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_PAYMENT_WEBHOOK_GRACE_MS,
  bookingProviderGraceCutoff,
  bookingProviderGraceEndsAt,
  cancellablePendingBookingWhere,
} from "./booking-expiry-policy";

test("provider-backed bookings keep a two-minute webhook reconciliation grace", () => {
  const deadline = new Date("2026-08-20T06:00:00.000Z");
  assert.equal(BOOKING_PAYMENT_WEBHOOK_GRACE_MS, 120_000);
  assert.equal(
    bookingProviderGraceEndsAt(deadline).toISOString(),
    "2026-08-20T06:02:00.000Z",
  );
  assert.equal(
    bookingProviderGraceCutoff(new Date("2026-08-20T06:02:00.000Z")).toISOString(),
    deadline.toISOString(),
  );
});

test("paid-before-deadline payment remains protected while its webhook is late", () => {
  const now = new Date("2026-08-20T06:01:00.000Z");
  const where = cancellablePendingBookingWhere(now);

  // Once the webhook records success, the evidence exclusion protects the
  // booking indefinitely. Before it arrives, an active provider attempt is
  // protected until the same two-minute grace cutoff.
  assert.deepEqual(where.beamPayments, {
    none: { status: { in: ["SUCCEEDED", "REVIEW_REQUIRED"] } },
  });
  assert.deepEqual(where.xenditPayments, {
    none: { status: { in: ["SUCCEEDED", "REVIEW_REQUIRED"] } },
  });
  assert.deepEqual((where.OR as unknown[])[1], {
    paymentExpiresAt: {
      lte: new Date("2026-08-20T05:59:00.000Z"),
    },
  });
});

test("review-required payment evidence is never capacity-cancelled", () => {
  const serialized = JSON.stringify(
    cancellablePendingBookingWhere(new Date("2026-08-20T06:10:00.000Z")),
  );

  assert.match(serialized, /REVIEW_REQUIRED/);
  assert.equal((serialized.match(/REVIEW_REQUIRED/g) ?? []).length, 2);
});

test("ordinary expired pending booking with no provider evidence remains cancellable", () => {
  const where = cancellablePendingBookingWhere(
    new Date("2026-08-20T06:10:00.000Z"),
  );

  assert.equal(where.status, "PENDING");
  assert.equal(where.paidAt, null);
  assert.deepEqual(where.paymentExpiresAt, {
    lte: new Date("2026-08-20T06:10:00.000Z"),
  });
  assert.deepEqual((where.OR as unknown[])[0], {
    beamPayments: { none: { status: { in: ["INITIATED", "PENDING"] } } },
    xenditPayments: { none: { status: "PENDING" } },
  });
});
