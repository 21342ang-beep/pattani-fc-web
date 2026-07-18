import Link from "next/link";
import { ArrowUpRight, Landmark, WalletCards } from "lucide-react";
import { verifyPermission } from "@/lib/dal";

export const metadata = { title: "บัญชี — Pattani FC Admin" };

export default async function AccountPage() {
  await verifyPermission("ACCOUNT");

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-widest text-yellow-600">Account</p>
        <h1 className="mt-1 text-3xl font-black text-green-900">บัญชี</h1>
        <p className="mt-2 text-slate-600">เลือกแหล่งข้อมูลยอดเงินที่ต้องการตรวจสอบ</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Link href="/admin/finance" className="group rounded-2xl border border-green-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md">
          <Landmark className="size-9 text-green-800" />
          <h2 className="mt-5 text-xl font-black text-green-900">ยอดเงินในระบบ</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">ดูรายรับ รายจ่าย และสรุปยอดจากระบบจัดการการเงินของสโมสร</p>
          <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-green-800">เปิดหน้าการเงิน <ArrowUpRight className="size-4" /></span>
        </Link>
        <a href="https://dashboard.xendit.co/" target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
          <WalletCards className="size-9 text-blue-700" />
          <h2 className="mt-5 text-xl font-black text-slate-900">ยอดเงินใน Xendit</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">เปิด Xendit Dashboard เพื่อตรวจสอบยอดคงเหลือและรายการรับชำระเงินจริง</p>
          <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-blue-700">เปิด Xendit <ArrowUpRight className="size-4" /></span>
        </a>
      </div>
    </div>
  );
}
