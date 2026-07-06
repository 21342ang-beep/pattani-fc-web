import Link from "next/link";
import { verifyAdmin } from "@/lib/dal";
import ChangePasswordForm from "../profile/ChangePasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขรหัสผ่าน — Pattani FC Admin" };

export default async function ChangePasswordPage() {
  await verifyAdmin();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">แก้ไขรหัสผ่าน</h1>
        <p className="text-sm text-slate-500">
          กำหนดรหัสผ่านใหม่สำหรับบัญชีผู้ดูแลของคุณ
        </p>
      </div>

      <section className="rounded-lg border border-green-100 bg-white p-6 shadow-sm">
        <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
          <p className="font-semibold">เพื่อความปลอดภัย</p>
          <ul className="mt-1 list-disc pl-4">
            <li>ขั้นต่ำ 8 ตัวอักษร และต้องไม่เหมือนรหัสผ่านเดิม</li>
            <li>ใช้รหัสที่คนอื่นเดายาก (ผสมตัวอักษร ตัวเลข สัญลักษณ์)</li>
            <li>อย่าใช้รหัสซ้ำกับเว็บไซต์อื่น</li>
          </ul>
        </div>
        <ChangePasswordForm />
      </section>

      <p className="text-xs text-slate-500">
        ต้องการดูข้อมูลบัญชีของคุณ?{" "}
        <Link href="/admin/profile" className="font-semibold text-green-800 hover:underline">
          ไปที่โปรไฟล์ฉัน →
        </Link>
      </p>
    </div>
  );
}
