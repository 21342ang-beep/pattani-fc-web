import "server-only";

const OAUTH_PROVIDER_TIMEOUT_MS = 10_000;

/**
 * OAuth callbacks must never wait indefinitely on an upstream provider. Keep
 * provider responses out of the Next.js cache and give every individual
 * token/profile request its own deadline.
 */
export function fetchOAuthProvider(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS),
  });
}
