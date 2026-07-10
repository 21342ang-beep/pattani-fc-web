import { NextResponse } from "next/server";
import { createOAuthState, errorRedirectUrl } from "@/lib/oauth";
import { buildLineAuthUrl, isLineConfigured } from "@/lib/oauth-line";

// GET = ปุ่ม "LINE" บนหน้า login ลูกค้า (intent=login, ไม่ต้อง consent)
// การสมัคร (register) ไม่ผ่าน route นี้แล้ว — ใช้ server action registerCustomer
export async function GET() {
  if (!isLineConfigured()) {
    return NextResponse.redirect(
      errorRedirectUrl("login", "provider_not_configured"),
    );
  }
  const nonce = await createOAuthState("LINE", "login", false);
  return NextResponse.redirect(buildLineAuthUrl(nonce, nonce));
}
