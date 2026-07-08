import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { readCustomerSession } from "@/lib/customer-session";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "สมัครสมาชิก — Pattani FC" };

const ERROR_MESSAGES: Record<string, string> = {
  missing_consent: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก",
  no_email:
    "บัญชี LINE ของคุณไม่ได้ให้อีเมล — กรุณาสมัครด้วยอีเมลหรือใช้ Google แทน",
  no_account:
    "ยังไม่พบบัญชีนี้ในระบบ — กรุณาสมัครสมาชิกก่อน (ยอมรับนโยบายด้านล่างแล้วกดปุ่ม social)",
  state_mismatch: "การเชื่อมต่อกับ provider หมดอายุ กรุณาลองใหม่",
  provider_denied: "คุณยกเลิกการอนุญาตกับ provider",
  provider_fetch_failed: "ไม่สามารถดึงข้อมูลจาก provider ได้",
  provider_not_configured: "ยังไม่ได้เปิดใช้บริการนี้ กรุณาสมัครด้วยอีเมลก่อน",
  email_not_verified:
    "อีเมลของบัญชี Google ยังไม่ได้ยืนยัน กรุณายืนยันก่อนเชื่อมต่อ",
  conflict: "เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี กรุณาลองใหม่",
};

export default async function RegisterPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readCustomerSession();
  if (session) redirect("/member");
  const sp = await props.searchParams;
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-green-50 via-yellow-50 to-green-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-7 shadow-xl">
        <div className="mb-5 flex flex-col items-center">
          <Image
            src="/logo-pattani-fc.png"
            alt="Pattani FC"
            width={64}
            height={64}
            priority
          />
          <h1 className="mt-3 text-2xl font-black text-green-900">
            สมัครสมาชิก
          </h1>
          <p className="mt-1 text-center text-sm text-slate-600">
            ลงทะเบียนเพื่อซื้อสินค้าทางการของสโมสร
            <br />
            และร่วมกิจกรรมลุ้นรางวัลพิเศษ
          </p>
        </div>

        <RegisterForm errorMessage={errorMessage} />

        <p className="mt-5 text-center text-sm text-slate-600">
          มีบัญชีอยู่แล้ว?{" "}
          <Link
            href="/member/login"
            className="font-semibold text-green-800 hover:underline"
          >
            เข้าสู่ระบบ
          </Link>
        </p>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-green-800"
          >
            <Shield className="size-3.5" />
            เป็นผู้ดูแลระบบ? เข้าสู่ระบบที่นี่
          </Link>
        </div>
      </div>
    </main>
  );
}
