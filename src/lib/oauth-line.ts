import "server-only";
import { buildRedirectUri } from "@/lib/oauth";
import {
  mergeVerifiedLineProfile,
  validateVerifiedLineClaims,
} from "@/lib/oauth-line-policy";
import { fetchOAuthProvider } from "@/lib/oauth-network";

// LINE Login v2.1 uses OpenID Connect. Email may be absent when the LINE
// channel has not been approved for the email scope, so the verified `sub` is
// always the authoritative provider identity.
const AUTH_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const PROFILE_URL = "https://api.line.me/v2/profile";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export function isLineConfigured(): boolean {
  return !!(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
}

function requireCreds() {
  const clientId = process.env.LINE_CHANNEL_ID;
  const clientSecret = process.env.LINE_CHANNEL_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "LINE OAuth is not configured (LINE_CHANNEL_ID / LINE_CHANNEL_SECRET)",
    );
  }
  return { clientId, clientSecret };
}

export function buildLineAuthUrl(state: string, nonce: string): string {
  const { clientId } = requireCreds();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: buildRedirectUri("LINE"),
    state,
    scope: "profile openid email",
    nonce,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type LineProfile = {
  providerAccountId: string;
  email: string | null;
  name: string | null;
};

export async function fetchLineProfile(
  code: string,
  expectedNonce: string,
): Promise<LineProfile> {
  const { clientId, clientSecret } = requireCreds();

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: buildRedirectUri("LINE"),
    client_id: clientId,
    client_secret: clientSecret,
  });
  const tokenRes = await fetchOAuthProvider(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenRes.ok) {
    throw new Error(`LINE token exchange failed: ${tokenRes.status}`);
  }
  const token = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!token.access_token) throw new Error("no access_token from LINE");
  if (!token.id_token) throw new Error("no id_token from LINE");

  // Trust only the claims returned by LINE's verification endpoint. Locally
  // decoding the JWT payload would not authenticate the claims.
  const verifyBody = new URLSearchParams({
    id_token: token.id_token,
    client_id: clientId,
  });
  const verifyRes = await fetchOAuthProvider(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyBody,
  });
  if (!verifyRes.ok) {
    throw new Error(`LINE ID token verification failed: ${verifyRes.status}`);
  }
  const verifiedClaims = (await verifyRes.json()) as Record<string, unknown>;
  let identity = validateVerifiedLineClaims(verifiedClaims, expectedNonce);

  // The access-token profile may fill a missing display name, but only after
  // proving it belongs to the exact same subject as the verified ID token.
  if (!identity.name) {
    const profileRes = await fetchOAuthProvider(PROFILE_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileRes.ok) {
      throw new Error(`LINE profile fetch failed: ${profileRes.status}`);
    }
    const profile = (await profileRes.json()) as Record<string, unknown>;
    identity = mergeVerifiedLineProfile(identity, profile);
  }

  return identity;
}
