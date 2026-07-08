import { NextResponse } from "next/server";
import {
  consumeOAuthState,
  errorRedirectUrl,
  successRedirectUrl,
} from "@/lib/oauth";
import { fetchGoogleProfile, isGoogleConfigured } from "@/lib/oauth-google";
import { oauthSignIn } from "@/lib/oauth-signin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam || !code || !state) {
    return NextResponse.redirect(errorRedirectUrl("login", "provider_denied"));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      errorRedirectUrl("login", "provider_not_configured"),
    );
  }

  const stateData = await consumeOAuthState("GOOGLE", state);
  if (!stateData) {
    return NextResponse.redirect(errorRedirectUrl("login", "state_mismatch"));
  }

  let profile;
  try {
    profile = await fetchGoogleProfile(code);
  } catch {
    return NextResponse.redirect(
      errorRedirectUrl(stateData.intent, "provider_fetch_failed"),
    );
  }

  if (!profile.emailVerified) {
    return NextResponse.redirect(
      errorRedirectUrl(stateData.intent, "email_not_verified"),
    );
  }

  const result = await oauthSignIn({
    provider: "GOOGLE",
    providerAccountId: profile.providerAccountId,
    email: profile.email,
    name: profile.name,
    intent: stateData.intent,
    pdpaConsent: stateData.pdpaConsent,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      errorRedirectUrl(stateData.intent, result.code),
    );
  }
  return NextResponse.redirect(successRedirectUrl());
}
