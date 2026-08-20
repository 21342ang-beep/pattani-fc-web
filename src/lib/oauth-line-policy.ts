export type VerifiedLineIdentity = {
  providerAccountId: string;
  email: string | null;
  name: string | null;
};

/**
 * Accept identity claims only after LINE's /verify endpoint has authenticated
 * the ID token. The OIDC nonce binds that token to the encrypted, one-time
 * state created for this browser flow.
 */
export function validateVerifiedLineClaims(
  claims: Record<string, unknown>,
  expectedNonce: string,
): VerifiedLineIdentity {
  if (!expectedNonce || claims.nonce !== expectedNonce) {
    throw new Error("LINE ID token nonce mismatch");
  }

  const sub = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!sub) throw new Error("LINE ID token has no subject");

  return {
    providerAccountId: sub,
    email:
      typeof claims.email === "string" && claims.email.trim()
        ? claims.email.trim().toLowerCase()
        : null,
    name:
      typeof claims.name === "string" && claims.name.trim()
        ? claims.name.trim()
        : null,
  };
}

/**
 * The access-token profile endpoint may supplement the verified ID token with
 * a display name, but it must never be allowed to replace its identity.
 */
export function mergeVerifiedLineProfile(
  identity: VerifiedLineIdentity,
  profile: Record<string, unknown>,
): VerifiedLineIdentity {
  const profileUserId =
    typeof profile.userId === "string" ? profile.userId.trim() : "";
  if (!profileUserId || profileUserId !== identity.providerAccountId) {
    throw new Error("LINE profile subject mismatch");
  }

  const displayName =
    typeof profile.displayName === "string" && profile.displayName.trim()
      ? profile.displayName.trim()
      : null;

  return {
    ...identity,
    name: identity.name ?? displayName,
  };
}
