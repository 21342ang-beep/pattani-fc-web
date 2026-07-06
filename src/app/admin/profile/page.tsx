import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "โปรไฟล์ฉัน — Pattani FC Admin" };

export default async function ProfilePage() {
  const session = await verifyAdmin();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">โปรไฟล์ฉัน</h1>
        <p className="text-sm text-slate-500">
          จัดการบัญชีผู้ดูแลของคุณ
        </p>
      </div>

      <section className="rounded-lg border border-green-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-green-900">ข้อมูลบัญชี</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">อีเมล</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">ชื่อ</dt>
            <dd className="font-medium">{user?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">สิทธิ์</dt>
            <dd>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  user?.role === "SUPER_ADMIN"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {user?.role ?? "—"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">สร้างเมื่อ</dt>
            <dd className="font-medium">
              {user?.createdAt ? formatDateTime(user.createdAt) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-green-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-green-900">เปลี่ยนรหัสผ่าน</h2>
        <p className="mb-4 text-xs text-slate-500">
          ขั้นต่ำ 8 ตัวอักษร และต้องไม่เหมือนรหัสผ่านเดิม
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
