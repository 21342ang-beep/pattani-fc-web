import { NextResponse } from "next/server";
import { createOAuthState, errorRedirectUrl } from "@/lib/oauth";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/oauth-google";

// GET = ปุ่ม "Google" บนหน้า login ลูกค้า (intent=login, ไม่ต้อง consent)
// การสมัคร (register) ไม่ผ่าน route นี้แล้ว — ใช้ server action registerCustomer
// ที่ validate ฟอร์มครบ + แนบข้อมูลลูกค้าลง OAuth state ก่อน redirect
export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      errorRedirectUrl("login", "provider_not_configured"),
    );
  }
  const nonce = await createOAuthState("GOOGLE", "login", false);
  return NextResponse.redirect(buildGoogleAuthUrl(nonce));
}
