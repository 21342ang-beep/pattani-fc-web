type TemporalClaims = {
  exp?: unknown;
  iat?: unknown;
  expiresAt?: unknown;
};

/** Validate every time claim that legacy tokens were expected to contain. */
export function hasValidLegacySessionTimes(
  claims: TemporalClaims,
  maxTtlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): claims is { exp: number; iat: number; expiresAt: number } {
  const { exp, iat, expiresAt } = claims;
  if (
    typeof exp !== "number" ||
    typeof iat !== "number" ||
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(exp) ||
    !Number.isSafeInteger(iat) ||
    !Number.isSafeInteger(expiresAt)
  ) {
    return false;
  }
  if (iat < 0 || iat > nowSeconds || exp <= nowSeconds || exp <= iat) {
    return false;
  }
  if (exp - iat > maxTtlSeconds) return false;
  // The old token stored expiresAt in milliseconds and exp in seconds.
  return Math.abs(expiresAt - exp * 1000) < 1_000;
}

export function getLegacyUpgradeTimes(
  claims: TemporalClaims,
  maxTtlSeconds: number,
  cutoffSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): { issuedAt: number; expiration: number } | null {
  if (!hasValidLegacySessionTimes(claims, maxTtlSeconds, nowSeconds)) {
    return null;
  }
  const expiration = Math.min(claims.exp, cutoffSeconds);
  if (expiration <= nowSeconds) return null;
  return { issuedAt: claims.iat, expiration };
}
