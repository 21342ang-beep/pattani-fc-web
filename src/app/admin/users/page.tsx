import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { ADMIN_PERMISSION_LABELS } from "@/lib/admin-permissions";
import CreateUserForm from "./CreateUserForm";
import DeleteUserButton from "./DeleteUserButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "ผู้ดูแลระบบ — Pattani FC Admin" };

export default async function UsersPage() {
  const session = await verifyAdmin();
  if (session.role !== "SUPER_ADMIN") redirect("/admin");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">ผู้ดูแลระบบ</h1>
        <p className="mt-1 text-sm text-slate-500">
          จัดการบัญชี admin — กำหนด Role และสิทธิ์เข้าถึงแต่ละหมวด (SUPER_ADMIN เท่านั้น)
        </p>
      </div>

      <CreateUserForm />

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-green-50 text-left text-xs uppercase text-green-900">
            <tr>
              <th className="px-4 py-2">อีเมล</th>
              <th className="px-4 py-2">ชื่อ</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">สิทธิ์เข้าหมวด</th>
              <th className="px-4 py-2">เพิ่มเมื่อ</th>
              <th className="px-4 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  ยังไม่มีผู้ดูแลในระบบ
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === session.userId;
                return (
                  <tr key={u.id} className="border-t align-top">
                    <td className="px-4 py-3 font-medium text-green-900">
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          คุณ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      {u.role === "SUPER_ADMIN" ? (
                        <span className="text-xs italic text-slate-500">
                          ทุกหมวด (bypass)
                        </span>
                      ) : u.permissions.length === 0 ? (
                        <span className="text-xs italic text-amber-700">
                          ยังไม่มีสิทธิ์เข้าหมวดใด
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.permissions.map((p) => (
                            <span
                              key={p}
                              className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                            >
                              {ADMIN_PERMISSION_LABELS[p] ?? p}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="text-xs font-semibold text-green-700 hover:text-green-900"
                        >
                          แก้ไข
                        </Link>
                        {!isSelf && (
                          <DeleteUserButton
                            userId={u.id}
                            email={u.email}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">หมายเหตุ</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>SUPER_ADMIN เข้าถึงทุกหมวดโดยอัตโนมัติ ไม่ต้องติ๊ก checkbox</li>
          <li>ADMIN จะเห็นเฉพาะหมวดที่ถูก grant — เมนู sidebar จะซ่อนอัตโนมัติ</li>
          <li>ระบบไม่ยอมให้ลบ SUPER_ADMIN คนสุดท้าย และห้ามลด role ของตัวเอง</li>
        </ul>
      </div>
    </div>
  );
}
