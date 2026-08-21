import assert from "node:assert/strict";
import { test } from "node:test";
import {
  InvalidJsonBodyError,
  RequestBodyTooLargeError,
  jsonNoStore,
  rateLimitedJson,
  readJsonBodyLimited,
  readRequestBodyLimited,
} from "./payment-http";
import {
  PAYMENT_REVIEW_STATUS,
  PAYMENT_SUCCESS_STATUS,
  bookingCanAutomaticallyConfirm,
  paymentCanAutomaticallySucceed,
  paymentEvidenceAllowsTargetDeletion,
  paymentEvidenceMustBeRetained,
  paymentEnvelopeError,
  paymentStatusAfterFailure,
  paymentTargetCount,
  paymentTimestampError,
  providerAmountToMinorUnits,
} from "./payment-state";
import { activeSeasonPassOrderWhere } from "./season-pass-expiry";

test("payment success and failure transitions are monotonic", () => {
  assert.equal(paymentCanAutomaticallySucceed("INITIATED"), true);
  assert.equal(paymentCanAutomaticallySucceed("PENDING"), true);
  for (const status of ["FAILED", "EXPIRED", PAYMENT_REVIEW_STATUS, PAYMENT_SUCCESS_STATUS]) {
    assert.equal(paymentCanAutomaticallySucceed(status), false);
  }

  assert.equal(paymentStatusAfterFailure("INITIATED"), "FAILED");
  assert.equal(paymentStatusAfterFailure("PENDING"), "FAILED");
  assert.equal(paymentStatusAfterFailure("FAILED"), "FAILED");
  assert.equal(paymentStatusAfterFailure("EXPIRED"), "EXPIRED");
  assert.equal(paymentStatusAfterFailure(PAYMENT_REVIEW_STATUS), PAYMENT_REVIEW_STATUS);
  assert.equal(paymentStatusAfterFailure(PAYMENT_SUCCESS_STATUS), PAYMENT_SUCCESS_STATUS);
});

test("on-time Beam payments can confirm pending or recently cancelled bookings", () => {
  assert.equal(bookingCanAutomaticallyConfirm("PENDING"), true);
  assert.equal(bookingCanAutomaticallyConfirm("CANCELLED"), true);
  for (const status of ["CONFIRMED", "REFUNDED", "FAILED", "UNKNOWN"]) {
    assert.equal(bookingCanAutomaticallyConfirm(status), false);
  }
});

test("paid and review-required evidence blocks booking and season inventory cleanup", () => {
  assert.equal(paymentEvidenceMustBeRetained(PAYMENT_SUCCESS_STATUS), true);
  assert.equal(paymentEvidenceMustBeRetained(PAYMENT_REVIEW_STATUS), true);
  assert.equal(paymentEvidenceMustBeRetained("FAILED"), false);

  assert.equal(paymentEvidenceAllowsTargetDeletion("FAILED"), true);
  assert.equal(paymentEvidenceAllowsTargetDeletion("EXPIRED"), true);
  for (const status of ["INITIATED", "PENDING", PAYMENT_REVIEW_STATUS, PAYMENT_SUCCESS_STATUS, "UNKNOWN"]) {
    assert.equal(paymentEvidenceAllowsTargetDeletion(status), false);
  }
});

test("season-pass active inventory retains paid and review-required reservations", () => {
  const where = JSON.stringify(
    activeSeasonPassOrderWhere(new Date("2030-01-01T00:00:00.000Z")),
  );
  assert.match(where, /SUCCEEDED/);
  assert.match(where, /REVIEW_REQUIRED/);
});

test("provider major-unit amounts convert to exact minor units", () => {
  assert.equal(providerAmountToMinorUnits(170), 17_000);
  assert.equal(providerAmountToMinorUnits(170.25), 17_025);
  assert.equal(providerAmountToMinorUnits(0), null);
  assert.equal(providerAmountToMinorUnits(Number.POSITIVE_INFINITY), null);
  assert.equal(providerAmountToMinorUnits(1.001), null);
});

test("provider envelope must match amount, provider id, and exactly one target", () => {
  const valid = {
    storedAmount: 17_000,
    receivedAmount: 17_000,
    storedProviderId: "ch_exact",
    receivedProviderId: "ch_exact",
    targetCount: 1,
  };
  assert.equal(paymentEnvelopeError(valid), null);
  assert.equal(paymentEnvelopeError({ ...valid, storedAmount: 0 }), "invalid_stored_amount");
  assert.equal(paymentEnvelopeError({ ...valid, receivedAmount: -1 }), "invalid_provider_amount");
  assert.equal(paymentEnvelopeError({ ...valid, receivedAmount: 17_001 }), "amount_mismatch");
  assert.equal(paymentEnvelopeError({ ...valid, targetCount: 0 }), "invalid_payment_target");
  assert.equal(paymentEnvelopeError({ ...valid, targetCount: 2 }), "invalid_payment_target");
  assert.equal(
    paymentEnvelopeError({ ...valid, receivedProviderId: "ch_other" }),
    "provider_id_mismatch",
  );

  assert.equal(paymentTargetCount({
    bookingId: "booking-1",
    seasonPassOrderId: null,
    seasonPassPurchaseId: null,
  }), 1);
  assert.equal(paymentTargetCount({
    bookingId: "booking-1",
    seasonPassOrderId: "order-1",
    seasonPassPurchaseId: null,
  }), 2);
});

test("provider payment timestamp must belong to the stored payment window", () => {
  const createdAt = new Date("2030-01-01T00:00:00.000Z");
  const expiresAt = new Date("2030-01-01T00:05:00.000Z");
  const now = new Date("2030-01-01T00:06:00.000Z");
  const base = {
    paymentCreatedAt: createdAt,
    paymentExpiresAt: expiresAt,
    now,
    allowedClockSkewMs: 60_000,
  };
  assert.equal(paymentTimestampError({ ...base, paidAt: expiresAt }), null);
  assert.equal(
    paymentTimestampError({ ...base, paidAt: new Date("2029-12-31T23:58:59.000Z") }),
    "payment_timestamp_before_request",
  );
  assert.equal(
    paymentTimestampError({ ...base, paidAt: new Date("2030-01-01T00:07:01.000Z") }),
    "payment_timestamp_in_future",
  );
  assert.equal(
    paymentTimestampError({ ...base, paidAt: new Date("2030-01-01T00:05:00.001Z") }),
    "provider_payment_late",
  );
});

test("limited JSON reader rejects oversized and invalid request bodies", async () => {
  const parsed = await readJsonBodyLimited(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ bookingCode: "cm12345678" }),
  }), 100);
  assert.deepEqual(parsed, { bookingCode: "cm12345678" });

  await assert.rejects(
    readRequestBodyLimited(new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "999" },
      body: "{}",
    }), 10),
    RequestBodyTooLargeError,
  );
  await assert.rejects(
    readRequestBodyLimited(new Request("https://example.test", {
      method: "POST",
      body: "12345",
    }), 4),
    RequestBodyTooLargeError,
  );
  await assert.rejects(
    readJsonBodyLimited(new Request("https://example.test", {
      method: "POST",
      body: "not-json",
    }), 100),
    InvalidJsonBodyError,
  );
});

test("payment JSON responses cannot be cached and rate limits expose retry timing", () => {
  const response = jsonNoStore({ ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);

  const limited = rateLimitedJson(0);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("cache-control"), "no-store");
  assert.equal(limited.headers.get("retry-after"), "1");
});
