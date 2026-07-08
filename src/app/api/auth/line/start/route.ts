import { NextResponse } from "next/server";
import {
  createOAuthState,
  errorRedirectUrl,
  type OAuthIntent,
} from "@/lib/oauth";
import { buildLineAuthUrl, isLineConfigured } from "@/lib/oauth-line";

export async function GET(req: Request) {
  return handle(req, { intent: "login", pdpaConsent: false });
}

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
  if (!isLineConfigured()) {
    return NextResponse.redirect(
      errorRedirectUrl(opts.intent, "provider_not_configured"),
      303,
    );
  }
  const nonce = await createOAuthState("LINE", opts.intent, opts.pdpaConsent);
  // 303 See Other → browser เปลี่ยน POST เป็น GET ก่อนไปที่ LINE
  // (307 จะยัง POST ต่อ → LINE ตอบ 405)
  return NextResponse.redirect(buildLineAuthUrl(nonce, nonce), 303);
}
