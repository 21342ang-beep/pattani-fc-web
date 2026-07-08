import "server-only";
import { buildRedirectUri } from "@/lib/oauth";

// LINE Login v2.1 (OpenID Connect-based)
// scope: profile + openid + (email — ต้องขอ approve จาก LINE)
// email อาจไม่มาถ้ายังไม่ approve → ใช้ userId (sub) เป็นหลัก

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
    throw new Error("LINE OAuth ยังไม่ได้ตั้งค่า (LINE_CHANNEL_ID / SECRET)");
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

// LINE id_token คือ JWT — decode payload ตรง ๆ (verify แล้วผ่าน /verify)
function decodeIdTokenPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchLineProfile(code: string): Promise<LineProfile> {
  const { clientId, clientSecret } = requireCreds();

  // 1) exchange code → access + id token
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: buildRedirectUri("LINE"),
    client_id: clientId,
    client_secret: clientSecret,
  });
  const tokenRes = await fetch(TOKEN_URL, {
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

  // 2) verify + decode id_token (มี email + sub + name เมื่อ scope=openid+email)
  let email: string | null = null;
  let name: string | null = null;
  let sub: string | null = null;
  if (token.id_token) {
    const verifyBody = new URLSearchParams({
      id_token: token.id_token,
      client_id: clientId,
    });
    const verifyRes = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody,
    });
    if (verifyRes.ok) {
      const payload = decodeIdTokenPayload(token.id_token);
      if (payload) {
        if (typeof payload.sub === "string") sub = payload.sub;
        if (typeof payload.email === "string") email = payload.email.toLowerCase();
        if (typeof payload.name === "string") name = payload.name;
      }
    }
  }

  // 3) fallback — เรียก /v2/profile ด้วย access_token ถ้ายังขาด sub/name
  if (!sub || !name) {
    const profileRes = await fetch(PROFILE_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as {
        userId?: string;
        displayName?: string;
      };
      if (!sub && profile.userId) sub = profile.userId;
      if (!name && profile.displayName) name = profile.displayName;
    }
  }

  if (!sub) throw new Error("no userId from LINE");

  return {
    providerAccountId: sub,
    email,
    name,
  };
}
