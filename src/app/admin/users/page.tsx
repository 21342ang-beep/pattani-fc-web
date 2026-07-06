import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ผู้ดูแลระบบ — Pattani FC Admin" };

export default async function UsersPage() {
  const session = await verifyAdmin();
  if (session.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">ผู้ดูแลระบบ</h1>
        <p className="text-sm text-slate-500">
          รายชื่อผู้มีสิทธิเข้าหลังบ้าน (เฉพาะ SUPER_ADMIN เท่านั้นที่ดูได้)
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-green-50 text-left text-xs uppercase text-green-900">
            <tr>
              <th className="px-4 py-2">อีเมล</th>
              <th className="px-4 py-2">ชื่อ</th>
              <th className="px-4 py-2">สิทธิ์</th>
              <th className="px-4 py-2">เพิ่มเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  ยังไม่มีผู้ดูแลในระบบ
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-green-900">
                    {u.email}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{u.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.role === "SUPER_ADMIN"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {formatDateTime(u.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
        หมายเหตุ: หน้านี้แสดงเฉพาะข้อมูลที่ปลอดภัย (ไม่มีรหัสผ่าน) การเพิ่ม/ลบผู้ดูแล
        ยังต้องทำผ่าน seed script หรือ DB โดยตรงในตอนนี้
      </p>
    </div>
  );
}
