import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Proxy (Next.js 16: เดิมชื่อ middleware) — optimistic check จาก cookie
// การตรวจจริงทำใน DAL อีกชั้นที่ data source
//
// หมายเหตุ: import dynamic ของ jose แทน decrypt ใน lib เพราะ proxy ทำงานใน
// edge runtime ที่ห้าม `import "server-only"`

const ADMIN_PREFIX = "/admin";
const MEMBER_PREFIX = "/member";
const LOGIN_PATH = "/login";
const MEMBER_LOGIN_PATH = "/member/login";

const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);

type SessionRow = { kind?: string; role?: string; [k: string]: unknown };

async function verify(token: string | undefined): Promise<SessionRow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as SessionRow;
  } catch {
    return null;
  }
}

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const adminSession = await verify(req.cookies.get("session")?.value);
  const isAdmin =
    adminSession?.role === "ADMIN" || adminSession?.role === "SUPER_ADMIN";

  // /member ต้องเป็น customer เท่านั้น
  if (path.startsWith(MEMBER_PREFIX) && path !== MEMBER_LOGIN_PATH) {
    const customerSession = await verify(
      req.cookies.get("customer_session")?.value
    );
    const isCustomer = customerSession?.kind === "customer";
    if (!isCustomer) {
      return NextResponse.redirect(new URL(MEMBER_LOGIN_PATH, req.nextUrl));
    }
  }

  // /admin — admin only
  if (path.startsWith(ADMIN_PREFIX) && !isAdmin) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.nextUrl));
  }
  if (path === LOGIN_PATH && isAdmin) {
    return NextResponse.redirect(new URL(ADMIN_PREFIX, req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/member/:path*"],
};
