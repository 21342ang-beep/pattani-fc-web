import assert from "node:assert/strict";
import test from "node:test";
import {
  createBookingAccessToken,
  verifyBookingAccessToken,
} from "./booking-access-token";

test("booking access tokens are signed, scoped, and reject tampering", async () => {
  const previous = process.env.BOOKING_ACCESS_SECRET;
  process.env.BOOKING_ACCESS_SECRET = "booking-access-test-secret-that-is-long-enough-2026";
  try {
    const claim = {
      kind: "booking-direct" as const,
      bookingId: "booking-1",
      bookingCode: "BK12345678",
      customerId: null,
    };
    const token = await createBookingAccessToken(claim, 60);
    assert.deepEqual(await verifyBookingAccessToken(token), claim);

    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(await verifyBookingAccessToken(tampered), null);
  } finally {
    if (previous === undefined) delete process.env.BOOKING_ACCESS_SECRET;
    else process.env.BOOKING_ACCESS_SECRET = previous;
  }
});

test("expired booking access tokens are rejected", async () => {
  const previous = process.env.BOOKING_ACCESS_SECRET;
  process.env.BOOKING_ACCESS_SECRET = "booking-access-test-secret-that-is-long-enough-2026";
  try {
    const token = await createBookingAccessToken({
      kind: "booking-recovery",
      phone: "0812345678",
      customerId: null,
    }, -1);
    assert.equal(await verifyBookingAccessToken(token), null);
  } finally {
    if (previous === undefined) delete process.env.BOOKING_ACCESS_SECRET;
    else process.env.BOOKING_ACCESS_SECRET = previous;
  }
});
