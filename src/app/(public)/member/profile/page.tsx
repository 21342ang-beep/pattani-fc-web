import { verifyCustomer } from "@/lib/customer-dal";
import { formatDateTime } from "@/lib/format";
import ProfileForm from "./ProfileForm";
import DangerZone from "./DangerZone";

export const dynamic = "force-dynamic";
export const metadata = { title: "โปรไฟล์ — Pattani FC" };

export default async function ProfilePage() {
  const customer = await verifyCustomer();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-black text-green-900 md:text-3xl">โปรไฟล์</h1>
        <p className="mt-1 text-sm text-slate-600">
          จัดการข้อมูลส่วนตัว — อีเมลใช้สำหรับยืนยันการจองและไม่สามารถแก้ไขได้
        </p>
      </div>

      <section className="mt-6 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-green-900">ข้อมูลพื้นฐาน</h2>
        <ProfileForm
          defaults={{
            name: customer.name,
            email: customer.email,
            phone: customer.phone ?? "",
          }}
        />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoBox label="สมัครสมาชิกเมื่อ" value={formatDateTime(customer.createdAt)} />
        <InfoBox
          label="เข้าสู่ระบบครั้งล่าสุด"
          value={customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : "—"}
        />
      </section>

      <DangerZone />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-green-900">{value}</p>
    </div>
  );
}
