import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  confirmStoredPaymentTarget,
  type StoredPaymentTarget,
} from "./payment-confirmation";

const BOOKING_ID = "booking-1";
const BOOKING_CODE = "booking-code-1";
const MATCH_ID = "match-1";
const REFERENCE_ID = "payment-reference-1";
const PAYMENT_METHOD = "BEAM_PROMPTPAY";
const PAID_AT = new Date("2030-01-01T03:04:00.000Z");
const PAYMENT_DEADLINE = new Date("2030-01-01T03:05:00.000Z");

type BookingFixture = {
  id: string;
  bookingCode: string;
  matchId: string;
  quantity: number;
  zone: string | null;
  totalAmount: number;
  status: string;
  salesChannel: string;
  paidAt: Date | null;
  paymentExpiresAt: Date | null;
  match: {
    status: string;
    ticketZones: Array<{ code: string; capacity: number }>;
  };
};

type FakeTxOptions = {
  booking?: Partial<Omit<BookingFixture, "match">> & {
    match?: Partial<BookingFixture["match"]>;
  };
  occupiedQuantity?: number | null;
  updateCount?: number;
};

function createFakeTransaction(options: FakeTxOptions = {}) {
  const booking: BookingFixture = {
    id: BOOKING_ID,
    bookingCode: BOOKING_CODE,
    matchId: MATCH_ID,
    quantity: 2,
    zone: "A",
    totalAmount: 30_000,
    status: "PENDING",
    salesChannel: "ONLINE",
    paidAt: null,
    paymentExpiresAt: PAYMENT_DEADLINE,
    ...options.booking,
    match: {
      status: "ON_SALE",
      ticketZones: [{ code: "A", capacity: 10 }],
      ...options.booking?.match,
    },
  };
  const updateCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<{ data: Record<string, unknown> }> = [];
  const aggregateCalls: Array<Record<string, unknown>> = [];

  const tx = {
    $queryRaw: async () => [],
    booking: {
      findUnique: async () => booking,
      aggregate: async (args: Record<string, unknown>) => {
        aggregateCalls.push(args);
        return { _sum: { quantity: options.occupiedQuantity ?? 0 } };
      },
      updateMany: async (args: Record<string, unknown>) => {
        updateCalls.push(args);
        return { count: options.updateCount ?? 1 };
      },
    },
    bookingAuditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        auditCalls.push(args);
        return { id: "audit-1", ...args.data };
      },
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, booking, updateCalls, auditCalls, aggregateCalls };
}

function bookingTarget(overrides: Partial<StoredPaymentTarget> = {}): StoredPaymentTarget {
  return {
    bookingId: BOOKING_ID,
    seasonPassOrderId: null,
    seasonPassPurchaseId: null,
    amount: 30_000,
    referenceId: REFERENCE_ID,
    ...overrides,
  };
}

function confirmBooking(
  tx: Prisma.TransactionClient,
  targetOverrides: Partial<StoredPaymentTarget> = {},
  paidAt = PAID_AT,
) {
  return confirmStoredPaymentTarget(tx, bookingTarget(targetOverrides), {
    reference: { kind: "booking", code: BOOKING_CODE },
    paidAt,
    paymentMethod: PAYMENT_METHOD,
  });
}

test("an on-time paid CANCELLED booking is restored when capacity is safe", async () => {
  const harness = createFakeTransaction({
    booking: { status: "CANCELLED" },
    occupiedQuantity: 7,
  });

  const result = await confirmBooking(harness.tx);

  assert.deepEqual(result, {
    outcome: "CONFIRMED",
    kind: "booking",
    code: BOOKING_CODE,
    matchId: MATCH_ID,
  });
  assert.equal(harness.aggregateCalls.length, 1);
  assert.equal(harness.updateCalls.length, 1);
  assert.deepEqual(harness.updateCalls[0], {
    where: {
      id: BOOKING_ID,
      status: { in: ["PENDING", "CANCELLED"] },
      salesChannel: "ONLINE",
      paidAt: null,
      totalAmount: 30_000,
      paymentExpiresAt: { gte: PAID_AT },
    },
    data: {
      status: "CONFIRMED",
      paymentMethod: PAYMENT_METHOD,
      paidAt: PAID_AT,
      paymentExpiresAt: null,
    },
  });
  assert.equal(harness.auditCalls.length, 1);
  const audit = harness.auditCalls[0].data;
  assert.equal(audit.bookingId, BOOKING_ID);
  assert.equal(audit.bookingCode, BOOKING_CODE);
  assert.equal(audit.action, "STATUS_CHANGED");
  assert.equal(audit.previousStatus, "CANCELLED");
  assert.equal(audit.nextStatus, "CONFIRMED");
  assert.deepEqual(audit.details, {
    reason: "provider_payment_confirmed",
    referenceId: REFERENCE_ID,
    paymentMethod: PAYMENT_METHOD,
    paidAt: PAID_AT.toISOString(),
    restoredFromCancellation: true,
  });
});

test("an on-time paid PENDING booking is confirmed", async () => {
  const harness = createFakeTransaction({ occupiedQuantity: 8 });

  const result = await confirmBooking(harness.tx);

  assert.equal(result.outcome, "CONFIRMED");
  assert.equal(harness.updateCalls.length, 1);
  assert.equal(harness.auditCalls.length, 1);
  assert.equal(harness.auditCalls[0].data.previousStatus, "PENDING");
  assert.equal(harness.auditCalls[0].data.nextStatus, "CONFIRMED");
  assert.equal(
    (harness.auditCalls[0].data.details as Record<string, unknown>)
      .restoredFromCancellation,
    false,
  );
});

const reviewCases: Array<{
  name: string;
  reason: string;
  options?: FakeTxOptions;
  target?: Partial<StoredPaymentTarget>;
  paidAt?: Date;
}> = [
  {
    name: "payment arrived after the booking deadline",
    reason: "booking_payment_late",
    paidAt: new Date("2030-01-01T03:05:00.001Z"),
  },
  {
    name: "booking has no payment deadline",
    reason: "booking_deadline_missing",
    options: { booking: { paymentExpiresAt: null } },
  },
  {
    name: "stored payment amount does not match the booking",
    reason: "booking_amount_mismatch",
    target: { amount: 29_999 },
  },
  {
    name: "booking was not sold online",
    reason: "booking_not_online_unpaid",
    options: { booking: { salesChannel: "STAFF" } },
  },
  {
    name: "booking was refunded",
    reason: "booking_not_confirmable",
    options: { booking: { status: "REFUNDED" } },
  },
  {
    name: "match was cancelled",
    reason: "booking_match_closed",
    options: { booking: { match: { status: "CANCELLED" } } },
  },
  {
    name: "match was finished",
    reason: "booking_match_closed",
    options: { booking: { match: { status: "FINISHED" } } },
  },
  {
    name: "restoring the booking would exceed capacity",
    reason: "booking_capacity_unsafe",
    options: { booking: { status: "CANCELLED" }, occupiedQuantity: 9 },
  },
];

for (const reviewCase of reviewCases) {
  test(`${reviewCase.name} remains review-required without a booking mutation`, async () => {
    const harness = createFakeTransaction(reviewCase.options);

    const result = await confirmBooking(
      harness.tx,
      reviewCase.target,
      reviewCase.paidAt,
    );

    assert.deepEqual(result, {
      outcome: "REVIEW_REQUIRED",
      reason: reviewCase.reason,
      kind: "booking",
      code: BOOKING_CODE,
    });
    assert.equal(harness.updateCalls.length, 0);
    assert.equal(harness.auditCalls.length, 0);
  });
}

test("a failed booking compare-and-set remains review-required without an audit", async () => {
  const harness = createFakeTransaction({ updateCount: 0 });

  const result = await confirmBooking(harness.tx);

  assert.deepEqual(result, {
    outcome: "REVIEW_REQUIRED",
    reason: "booking_changed_during_confirmation",
    kind: "booking",
    code: BOOKING_CODE,
  });
  assert.equal(harness.updateCalls.length, 1);
  assert.equal(harness.auditCalls.length, 0);
});
