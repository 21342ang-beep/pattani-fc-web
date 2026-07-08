import { NextResponse } from "next/server";
import {
  createOAuthState,
  errorRedirectUrl,
  type OAuthIntent,
} from "@/lib/oauth";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/oauth-google";

// GET = จากปุ่มบน login page (intent=login, ไม่ต้อง consent)
export async function GET(req: Request) {
  return handle(req, {
    intent: "login",
    pdpaConsent: false,
  });
}

// POST = จากปุ่มบน register page (form submit + pdpaConsent field)
export async function POST(req: Request) {
  const form = await req.formData();
  const pdpaConsent = form.get("pdpaConsent") === "on";
  const intent = (form.get("intent") as OAuthIntent) || "register";
  if (intent === "register" && !pdpaConsent) {
    return NextResponse.redirect(
      errorRedirectUrl("register", "missing_consent"),
    );
  }
  return handle(req, { intent, pdpaConsent });
}

async function handle(
  _req: Request,
  opts: { intent: OAuthIntent; pdpaConsent: boolean },
) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      errorRedirectUrl(opts.intent, "provider_not_configured"),
      303,
    );
  }
  const nonce = await createOAuthState(
    "GOOGLE",
    opts.intent,
    opts.pdpaConsent,
  );
  // 303 See Other → browser เปลี่ยน POST เป็น GET ก่อนไปที่ provider
  return NextResponse.redirect(buildGoogleAuthUrl(nonce), 303);
}
