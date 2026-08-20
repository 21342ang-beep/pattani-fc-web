import assert from "node:assert/strict";
import test from "node:test";
import {
  getPhoneChangeStepUp,
  isProfilePhoneChanged,
  normalizeProfilePhone,
} from "./customer-profile-policy";

test("profile phone comparison treats Thai country-code formatting as equivalent", () => {
  assert.equal(normalizeProfilePhone("+66 81-234-5678"), "0812345678");
  assert.equal(isProfilePhoneChanged("081-234-5678", "+66 81 234 5678"), false);
});

test("changing or removing a phone requires a step-up", () => {
  assert.equal(isProfilePhoneChanged("0812345678", "0899999999"), true);
  assert.equal(isProfilePhoneChanged("0812345678", ""), true);
  assert.equal(
    getPhoneChangeStepUp({
      currentPhone: "0812345678",
      nextPhone: "0899999999",
      hasPassword: true,
      currentPassword: "",
    }),
    "password-required",
  );
  assert.equal(
    getPhoneChangeStepUp({
      currentPhone: "0812345678",
      nextPhone: "0899999999",
      hasPassword: true,
      currentPassword: "correct horse battery staple",
    }),
    "verify-password",
  );
});

test("social-only accounts cannot self-service a phone ownership change", () => {
  assert.equal(
    getPhoneChangeStepUp({
      currentPhone: "0812345678",
      nextPhone: "0899999999",
      hasPassword: false,
      currentPassword: "anything",
    }),
    "blocked-social-only",
  );
});

test("name-only saves do not require a password", () => {
  assert.equal(
    getPhoneChangeStepUp({
      currentPhone: "0812345678",
      nextPhone: "081-234-5678",
      hasPassword: false,
      currentPassword: undefined,
    }),
    "not-required",
  );
});
