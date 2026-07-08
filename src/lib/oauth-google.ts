import "server-only";
import { buildRedirectUri } from "@/lib/oauth";

// Google OAuth 2.0 (OIDC)
// scope: openid + email + profile → ได้ sub, email, name, picture

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function requireCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth ยังไม่ได้ตั้งค่า (GOOGLE_CLIENT_ID / SECRET)");
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId } = requireCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: buildRedirectUri("GOOGLE"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type GoogleProfile = {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

export async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = requireCreds();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: buildRedirectUri("GOOGLE"),
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("no access_token from Google");

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`Google userinfo failed: ${userRes.status}`);
  }
  const user = (await userRes.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  return {
    providerAccountId: user.sub,
    email: user.email?.toLowerCase() ?? null,
    emailVerified: !!user.email_verified,
    name: user.name ?? null,
  };
}
