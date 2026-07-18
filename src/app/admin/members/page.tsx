import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ข้อมูลผู้ใช้งาน — Pattani FC Admin" };

export default async function MembersPage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  await verifyPermission("MEMBER_DATA");
  const { q: rawQuery } = await props.searchParams;
  const q = (rawQuery ?? "").trim().slice(0, 100);
  const members = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      accounts: { select: { provider: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">ข้อมูลผู้ใช้งาน</h1>
        <p className="text-sm text-slate-500">รายชื่อผู้ที่สมัครสมาชิกกับสโมสรปัตตานี เอฟซี</p>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อ / อีเมล / เบอร์โทร"
          className="rounded-md border border-green-200 px-3 py-1.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        />
        <button className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-semibold text-yellow-300 hover:bg-green-900">ค้นหา</button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-green-50 text-left text-xs uppercase text-green-900">
            <tr>
              <th className="px-3 py-2">ผู้ใช้งาน</th>
              <th className="px-3 py-2">ติดต่อ</th>
              <th className="px-3 py-2">สมัครผ่าน</th>
              <th className="px-3 py-2">วันที่สมัคร</th>
              <th className="px-3 py-2">เข้าใช้ล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">ไม่พบข้อมูลผู้ใช้งาน</td></tr>
            ) : members.map((member) => (
              <tr key={member.id} className="border-t">
                <td className="px-3 py-2 font-medium text-green-900">
                  <div>{member.name}</div>
                  <div className="mt-0.5 text-xs font-normal text-slate-500">{member.emailVerifiedAt ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}</div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600"><div>{member.email}</div><div>{member.phone ?? "—"}</div></td>
                <td className="px-3 py-2 text-xs text-slate-600">{member.accounts.length ? member.accounts.map((account) => account.provider).join(", ") : "อีเมล / รหัสผ่าน"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(member.createdAt)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "ยังไม่เคยเข้าใช้"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">แสดงได้สูงสุด 100 บัญชีล่าสุด</p>
    </div>
  );
}
