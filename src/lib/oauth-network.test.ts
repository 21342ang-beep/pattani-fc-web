import assert from "node:assert/strict";
import test from "node:test";
import { fetchOAuthProvider } from "./oauth-network";

const ORIGINAL_FETCH = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

test("OAuth provider fetches are no-store and always have an enforced timeout", async () => {
  let capturedInit: RequestInit | undefined;
  const callerController = new AbortController();
  globalThis.fetch = (async (_input, init) => {
    capturedInit = init;
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  await fetchOAuthProvider("https://provider.invalid/token", {
    method: "POST",
    signal: callerController.signal,
  });

  assert.equal(capturedInit?.cache, "no-store");
  assert.equal(capturedInit?.method, "POST");
  assert.ok(capturedInit?.signal);
  assert.notEqual(capturedInit?.signal, callerController.signal);
});
