import Image from "next/image";
import Link from "next/link";
import { Shield, Users } from "lucide-react";
import LoginForm from "./LoginForm";

export const metadata = { title: "เข้าสู่ระบบผู้ดูแล — Pattani FC" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-950 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-300/20 bg-white p-7 shadow-2xl">
        <div className="mb-5 flex flex-col items-center">
          <div className="relative">
            <Image
              src="/logo-pattani-fc.png"
              alt="Pattani FC"
              width={72}
              height={72}
            />
            <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-green-800 text-yellow-300 ring-2 ring-white">
              <Shield className="size-3.5" />
            </span>
          </div>
          <h1 className="mt-3 text-xl font-black text-green-900">
            เข้าสู่ระบบผู้ดูแล
          </h1>
          <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
            <Shield className="size-3" />
            ADMIN AREA
          </p>
          <p className="mt-2 text-center text-xs text-slate-500">
            สำหรับเจ้าหน้าที่และผู้ดูแลระบบ Pattani FC เท่านั้น
            <br />
            ทุกการเข้าสู่ระบบจะถูกบันทึก
          </p>
        </div>

        <LoginForm />

        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          <Link
            href="/member/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 transition hover:text-green-800"
          >
            <Users className="size-3.5" />
            เป็นลูกค้า/แฟนคลับ? เข้าสู่ระบบสมาชิก
          </Link>
        </div>
      </div>
    </main>
  );
}
