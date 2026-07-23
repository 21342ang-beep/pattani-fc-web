import { NextResponse } from "next/server";
import {
  consumeOAuthState,
  errorRedirectUrl,
  successRedirectUrl,
} from "@/lib/oauth";
import { fetchLineProfile, isLineConfigured } from "@/lib/oauth-line";
import { oauthSignIn } from "@/lib/oauth-signin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam || !code || !state) {
    return NextResponse.redirect(errorRedirectUrl("login", "provider_denied"));
  }
  if (!isLineConfigured()) {
    return NextResponse.redirect(
      errorRedirectUrl("login", "provider_not_configured"),
    );
  }

  const stateData = await consumeOAuthState("LINE", state);
  if (!stateData) {
    return NextResponse.redirect(errorRedirectUrl("login", "state_mismatch"));
  }

  let profile;
  try {
    profile = await fetchLineProfile(code);
  } catch {
    return NextResponse.redirect(
      errorRedirectUrl(stateData.intent, "provider_fetch_failed"),
    );
  }

  const result = await oauthSignIn({
    provider: "LINE",
    providerAccountId: profile.providerAccountId,
    email: profile.email,
    name: profile.name,
    intent: stateData.intent,
    pdpaConsent: stateData.pdpaConsent,
    profile: stateData.profile,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      errorRedirectUrl(stateData.intent, result.code),
    );
  }
  return NextResponse.redirect(
    successRedirectUrl(
      result.emailChanged ? "email_from_line" : undefined,
      stateData.returnTo,
      stateData.intent === "register" ? "/tickets/season" : "/member",
    ),
  );
}
