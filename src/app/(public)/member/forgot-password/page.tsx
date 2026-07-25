import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ลืมรหัสผ่าน — Pattani FC" };

export default function ForgotPasswordPage() {
  return <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-green-50 via-yellow-50 to-green-100 px-4 py-12"><section className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-7 shadow-xl md:p-9"><h1 className="text-3xl font-black text-green-900">ลืมรหัสผ่าน</h1><p className="mt-2 text-slate-600">กรอกเบอร์มือถือที่ใช้สมัคร เราจะส่ง OTP เพื่อให้คุณตั้งรหัสใหม่</p><ForgotPasswordForm /><p className="mt-6 text-center text-sm text-slate-600"><Link href="/member/login" className="font-semibold text-green-800 hover:underline">กลับไปเข้าสู่ระบบ</Link></p></section></main>;
}
