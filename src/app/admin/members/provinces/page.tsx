import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { normalizeThaiProvinceName } from "@/lib/thai-province-coordinates";
import {
  ProvinceDashboard,
  type ProvinceStat,
} from "../MembersPage";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "แดชบอร์ดสมาชิกแยกตามจังหวัด — Pattani FC Admin",
};

export default async function MemberProvinceDashboardPage() {
  await verifyPermission("MEMBER_DATA");

  const [totalMembers, provinceGroups] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.groupBy({
      by: ["province"],
      _count: { _all: true },
    }),
  ]);

  const provinceCountByName = new Map<string, number>();
  for (const group of provinceGroups) {
    const province = group.province?.trim()
      ? normalizeThaiProvinceName(group.province)
      : "ไม่ระบุจังหวัด";
    provinceCountByName.set(
      province,
      (provinceCountByName.get(province) ?? 0) + group._count._all,
    );
  }
  const provinceStats: ProvinceStat[] = [...provinceCountByName.entries()]
    .map(([province, count]) => ({
      province,
      count,
      percentage: totalMembers > 0 ? (count / totalMembers) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.province.localeCompare(b.province, "th"),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-green-700">
            แดชบอร์ดข้อมูลสมาชิก
          </p>
          <h1 className="mt-1 text-3xl font-bold text-green-900 md:text-4xl">
            สมาชิกแยกตามจังหวัด
          </h1>
          <p className="mt-1 text-base text-slate-600 md:text-lg">
            จำนวนและสัดส่วนสมาชิกจากข้อมูลจังหวัดในบัญชีสมาชิก
          </p>
        </div>
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-white px-4 py-2.5 text-base font-semibold text-green-900 shadow-sm hover:bg-green-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          กลับหน้าข้อมูลสมาชิก
        </Link>
      </div>

      <ProvinceDashboard stats={provinceStats} totalMembers={totalMembers} />
    </div>
  );
}
