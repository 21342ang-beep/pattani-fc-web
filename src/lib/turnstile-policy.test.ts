import assert from "node:assert/strict";
import test from "node:test";
import { isValidRegistrationTurnstileResult } from "./turnstile-policy";

const hosts = new Set(["pattanifc.co", "www.pattanifc.co"]);

test("Turnstile registration requires the expected action and hostname", () => {
  assert.equal(
    isValidRegistrationTurnstileResult(
      { success: true, action: "register", hostname: "pattanifc.co" },
      hosts,
    ),
    true,
  );
  assert.equal(
    isValidRegistrationTurnstileResult(
      { success: true, action: "register", hostname: "attacker.example" },
      hosts,
    ),
    false,
  );
  assert.equal(
    isValidRegistrationTurnstileResult(
      { success: true, action: "login", hostname: "pattanifc.co" },
      hosts,
    ),
    false,
  );
});
