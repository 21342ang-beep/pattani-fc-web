import { verifyCustomer } from "@/lib/customer-dal";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "เปลี่ยนรหัสผ่าน — Pattani FC" };

export default async function ChangePasswordPage() {
  await verifyCustomer();

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-black text-green-900 md:text-3xl">
        เปลี่ยนรหัสผ่าน
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        ใส่รหัสผ่านปัจจุบันเพื่อยืนยันตัวตน — กรุณาตั้งรหัสที่คาดเดายาก
      </p>

      <section className="mt-6 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <ChangePasswordForm />
      </section>
    </div>
  );
}
