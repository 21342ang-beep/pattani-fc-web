import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_RECOVERY_RESPONSE_FLOOR_MS,
  PASSWORD_RECOVERY_RESPONSE_JITTER_MS,
  PASSWORD_RECOVERY_PROVIDER_TIMEOUT_MS,
  normalizeRegistrationPhone,
  passwordRecoveryResponseTargetMs,
  passwordRegistrationSecurityPlan,
  passwordResetPersistedChallenge,
  passwordResetShouldRequestProvider,
  passwordResetCommitAllowed,
  registrationChallengeActivationEligible,
  remainingRecoveryResponseDelayMs,
  uniqueVerifiedPhoneRecoveryOwner,
} from "./customer-registration-policy";

test("password registration creates no account or session before OTP", () => {
  const plan = passwordRegistrationSecurityPlan({
    challengeActive: true,
    activationEligible: true,
    otpVerified: false,
    verifiedAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  assert.deepEqual(plan, {
    createCustomer: false,
    issueCustomerSession: false,
    trustPhoneForRecovery: false,
    phoneVerifiedAt: null,
  });
});

test("verified OTP activates the account, session and recovery phone together", () => {
  const verifiedAt = new Date("2026-08-20T00:00:00.000Z");
  const plan = passwordRegistrationSecurityPlan({
    challengeActive: true,
    activationEligible: true,
    otpVerified: true,
    verifiedAt,
  });
  assert.equal(plan.createCustomer, true);
  assert.equal(plan.issueCustomerSession, true);
  assert.equal(plan.trustPhoneForRecovery, true);
  assert.equal(plan.phoneVerifiedAt, verifiedAt);
  assert.equal(
    uniqueVerifiedPhoneRecoveryOwner(
      plan.phoneVerifiedAt ? ["new-password-customer"] : [],
    ),
    "new-password-customer",
  );
  assert.equal(uniqueVerifiedPhoneRecoveryOwner([]), null);
  assert.equal(uniqueVerifiedPhoneRecoveryOwner(["one", "two"]), null);
});

test("expired challenge stays fail-closed even after an OTP provider success", () => {
  const plan = passwordRegistrationSecurityPlan({
    challengeActive: false,
    activationEligible: true,
    otpVerified: true,
    verifiedAt: new Date(),
  });
  assert.equal(plan.createCustomer, false);
  assert.equal(plan.issueCustomerSession, false);
});

test("duplicate registration follows OTP proof but can never activate", () => {
  assert.equal(
    registrationChallengeActivationEligible({
      emailAlreadyRegistered: true,
      verifiedPhoneOwnerCount: 0,
    }),
    false,
  );
  assert.equal(
    registrationChallengeActivationEligible({
      emailAlreadyRegistered: false,
      verifiedPhoneOwnerCount: 1,
    }),
    false,
  );
  const plan = passwordRegistrationSecurityPlan({
    challengeActive: true,
    activationEligible: false,
    otpVerified: true,
    verifiedAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  assert.equal(plan.createCustomer, false);
  assert.equal(plan.issueCustomerSession, false);
});

test("registration accepts only normalized Thai mobile numbers", () => {
  assert.equal(normalizeRegistrationPhone("+66 81-234-5678"), "0812345678");
  assert.equal(normalizeRegistrationPhone("021234567"), null);
  assert.equal(normalizeRegistrationPhone("08123"), null);
});

test("password recovery timing floor and jitter remain bounded", () => {
  assert.ok(
    PASSWORD_RECOVERY_RESPONSE_FLOOR_MS >
      PASSWORD_RECOVERY_PROVIDER_TIMEOUT_MS,
  );
  assert.equal(
    passwordRecoveryResponseTargetMs(0),
    PASSWORD_RECOVERY_RESPONSE_FLOOR_MS,
  );
  assert.equal(
    passwordRecoveryResponseTargetMs(1),
    PASSWORD_RECOVERY_RESPONSE_FLOOR_MS + PASSWORD_RECOVERY_RESPONSE_JITTER_MS,
  );
  assert.equal(
    remainingRecoveryResponseDelayMs({
      startedAtMs: 100,
      nowMs: 400,
      targetMs: 900,
    }),
    600,
  );
  assert.equal(
    remainingRecoveryResponseDelayMs({
      startedAtMs: 100,
      nowMs: 1_500,
      targetMs: 900,
    }),
    0,
  );
});

test("password reset commit requires the same still-live local challenge", () => {
  assert.equal(
    passwordResetCommitAllowed({
      challengeStillPresent: true,
      challengeCustomerId: "customer-1",
      expectedCustomerId: "customer-1",
    }),
    true,
  );
  assert.equal(
    passwordResetCommitAllowed({
      challengeStillPresent: false,
      challengeCustomerId: null,
      expectedCustomerId: "customer-1",
    }),
    false,
  );
  assert.equal(
    passwordResetCommitAllowed({
      challengeStillPresent: true,
      challengeCustomerId: "customer-2",
      expectedCustomerId: "customer-1",
    }),
    false,
  );
  assert.equal(
    passwordResetCommitAllowed({
      challengeStillPresent: true,
      challengeCustomerId: null,
      expectedCustomerId: null,
    }),
    false,
  );
});

test("unknown and provider-failed reset requests persist non-owner decoys", () => {
  assert.equal(passwordResetShouldRequestProvider(null), false);
  assert.equal(passwordResetShouldRequestProvider("customer-1"), true);
  assert.deepEqual(
    passwordResetPersistedChallenge({
      ownerCustomerId: null,
      issuedProviderToken: null,
      decoyProviderToken: "random-decoy",
    }),
    { customerId: null, providerToken: "random-decoy" },
  );
  assert.deepEqual(
    passwordResetPersistedChallenge({
      ownerCustomerId: "customer-1",
      issuedProviderToken: null,
      decoyProviderToken: "random-decoy",
    }),
    { customerId: null, providerToken: "random-decoy" },
  );
  assert.deepEqual(
    passwordResetPersistedChallenge({
      ownerCustomerId: "customer-1",
      issuedProviderToken: "provider-token",
      decoyProviderToken: "random-decoy",
    }),
    { customerId: "customer-1", providerToken: "provider-token" },
  );
});
