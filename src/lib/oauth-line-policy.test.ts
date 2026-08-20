import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeVerifiedLineProfile,
  validateVerifiedLineClaims,
} from "./oauth-line-policy";

test("LINE claims require the exact OIDC nonce", () => {
  assert.throws(
    () =>
      validateVerifiedLineClaims(
        { sub: "U123", nonce: "wrong" },
        "expected",
      ),
    /nonce mismatch/,
  );
  assert.throws(
    () => validateVerifiedLineClaims({ sub: "U123" }, "expected"),
    /nonce mismatch/,
  );
});

test("LINE identity is sourced from verified claims", () => {
  assert.deepEqual(
    validateVerifiedLineClaims(
      {
        sub: "U123",
        nonce: "expected",
        email: " PERSON@Example.COM ",
        name: " Example Person ",
      },
      "expected",
    ),
    {
      providerAccountId: "U123",
      email: "person@example.com",
      name: "Example Person",
    },
  );
});

test("LINE profile may supplement but never replace the verified subject", () => {
  const identity = validateVerifiedLineClaims(
    { sub: "U123", nonce: "expected" },
    "expected",
  );

  assert.deepEqual(
    mergeVerifiedLineProfile(identity, {
      userId: "U123",
      displayName: "Profile Name",
    }),
    { ...identity, name: "Profile Name" },
  );
  assert.throws(
    () =>
      mergeVerifiedLineProfile(identity, {
        userId: "ATTACKER",
        displayName: "Wrong Account",
      }),
    /subject mismatch/,
  );
});
