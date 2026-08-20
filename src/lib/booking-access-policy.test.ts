import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingAccessClaimAllows,
  bookingAccessClaimHasRequiredSession,
} from "./booking-access-policy";

const guestBooking = {
  id: "booking-1",
  bookingCode: "BK12345678",
  customerId: null,
  customerPhone: "081-234-5678",
};

test("direct booking grants are bound to the exact row and owner", () => {
  assert.equal(bookingAccessClaimAllows({
    kind: "booking-direct",
    bookingId: guestBooking.id,
    bookingCode: guestBooking.bookingCode,
    customerId: null,
  }, guestBooking), true);
  assert.equal(bookingAccessClaimAllows({
    kind: "booking-direct",
    bookingId: "other",
    bookingCode: guestBooking.bookingCode,
    customerId: null,
  }, guestBooking), false);
  assert.equal(bookingAccessClaimAllows({
    kind: "booking-direct",
    bookingId: guestBooking.id,
    bookingCode: guestBooking.bookingCode,
    customerId: "customer-1",
  }, guestBooking), false);
});

test("OTP recovery accepts phone variants but cannot cross member ownership", () => {
  const guestClaim = {
    kind: "booking-recovery" as const,
    phone: "+66 81 234 5678",
    customerId: null,
  };
  assert.equal(bookingAccessClaimAllows(guestClaim, guestBooking), true);
  assert.equal(bookingAccessClaimAllows(guestClaim, {
    ...guestBooking,
    customerId: "customer-1",
  }), false);

  const memberClaim = { ...guestClaim, customerId: "customer-1" };
  assert.equal(bookingAccessClaimAllows(memberClaim, guestBooking), true);
  assert.equal(bookingAccessClaimAllows(memberClaim, {
    ...guestBooking,
    customerId: "customer-1",
  }), true);
  assert.equal(bookingAccessClaimAllows(memberClaim, {
    ...guestBooking,
    customerId: "customer-2",
  }), false);
});

test("member-bound grants stop working without the matching live session", () => {
  const memberClaim = {
    kind: "booking-direct" as const,
    bookingId: guestBooking.id,
    bookingCode: guestBooking.bookingCode,
    customerId: "customer-1",
  };
  assert.equal(bookingAccessClaimHasRequiredSession(memberClaim, "customer-1"), true);
  assert.equal(bookingAccessClaimHasRequiredSession(memberClaim, null), false);
  assert.equal(bookingAccessClaimHasRequiredSession(memberClaim, "customer-2"), false);

  const guestClaim = { ...memberClaim, customerId: null };
  assert.equal(bookingAccessClaimHasRequiredSession(guestClaim, null), true);
});
