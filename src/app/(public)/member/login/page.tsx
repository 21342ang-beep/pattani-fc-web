import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { readCustomerSession } from "@/lib/customer-session";
import { getSafeReturnTo } from "@/lib/oauth";
import MemberLoginForm from "./MemberLoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "เข้าสู่ระบบสมาชิก — Pattani FC" };

const ERROR_MESSAGES: Record<string, string> = {
  no_account:
    "ยังไม่พบบัญชีนี้ในระบบ — กรุณาสมัครสมาชิกก่อน",
  state_mismatch: "การเชื่อมต่อกับ provider หมดอายุ กรุณาลองใหม่",
  provider_denied: "คุณยกเลิกการอนุญาตกับ provider",
  provider_fetch_failed: "ไม่สามารถดึงข้อมูลจาก provider ได้",
  provider_not_configured: "ยังไม่ได้เปิดใช้บริการนี้",
  email_not_verified:
    "อีเมลของบัญชี Google ยังไม่ได้ยืนยัน กรุณายืนยันก่อนเชื่อมต่อ",
  conflict: "เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี กรุณาลองใหม่",
};

export default async function MemberLoginPage(props: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const sp = await props.searchParams;
  const returnTo = getSafeReturnTo(sp.returnTo);
  const session = await readCustomerSession();
  if (session) redirect(returnTo ?? "/member");
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-green-50 via-yellow-50 to-green-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-7 shadow-xl md:p-9">
        <div className="mb-6 flex flex-col items-center">
          <Image
            src="/logo-pattani-fc.png"
            alt="Pattani FC"
            width={80}
            height={80}
          />
          <h1 className="mt-3 text-3xl font-black text-green-900 md:text-4xl">
            เข้าสู่ระบบสมาชิก
          </h1>
          <p className="mt-1.5 text-base text-slate-600 md:text-lg">
            สำหรับลูกค้าและแฟนคลับ Pattani FC
          </p>
        </div>

        <MemberLoginForm errorMessage={errorMessage} returnTo={returnTo ?? undefined} />

        <p className="mt-6 text-center text-base text-slate-600 md:text-lg">
          ยังไม่มีบัญชี?{" "}
          <Link
            href={returnTo ? `/register?next=${encodeURIComponent(returnTo)}` : "/register"}
            className="font-semibold text-green-800 hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </p>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-green-800"
          >
            <Shield className="size-4" />
            เป็นผู้ดูแลระบบ? เข้าสู่ระบบที่นี่
          </Link>
        </div>
      </div>
    </main>
  );
}
