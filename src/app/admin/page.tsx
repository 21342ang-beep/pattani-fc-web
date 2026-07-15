import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/format";
import { getAdminUser, hasPermission } from "@/lib/dal";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";
import type { Permission } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getAdminUser();

  const [matchCount, onSaleCount, bookingCount, revenue, customerCount] =
    await Promise.all([
      prisma.match.count(),
      prisma.match.count({ where: { status: "ON_SALE" } }),
      prisma.booking.count({
        where: { status: { in: ["PENDING", "CONFIRMED"] } },
      }),
      prisma.booking.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { totalAmount: true },
      }),
      prisma.customer.count(),
    ]);

  // สถิติเสริมต่อการ์ด — SUPER_ADMIN เห็นเสมอ, ADMIN เห็นเฉพาะที่มีสิทธิ์
  const stats: Partial<Record<Permission, string>> = {
    MATCHES: `${matchCount} แมตช์ · ${onSaleCount} เปิดขาย`,
    BOOKINGS: `${bookingCount} รายการ active`,
    CUSTOMERS: `${customerCount} บัญชี`,
    REPORTS: `ยอดยืนยัน ${formatBaht(revenue._sum.totalAmount ?? 0)}`,
  };

  const visibleSections = ADMIN_SECTIONS.filter((s) =>
    hasPermission(user, s.permission),
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-green-900">ภาพรวมหลังบ้าน</h1>
        <p className="mt-1 text-sm text-slate-600">
          สวัสดี {user.name || user.email} · เลือกหมวดที่ต้องการจัดการได้จากการ์ดด้านล่าง
        </p>
      </div>

      {/* สรุปตัวเลขรวม */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="แมตช์ทั้งหมด" value={matchCount.toLocaleString("th-TH")} />
        <StatPill
          label="เปิดจองอยู่"
          value={onSaleCount.toLocaleString("th-TH")}
          highlight
        />
        <StatPill label="การจอง active" value={bookingCount.toLocaleString("th-TH")} />
        <StatPill
          label="ยอดยืนยัน"
          value={formatBaht(revenue._sum.totalAmount ?? 0)}
        />
      </div>

      {/* การ์ดแต่ละหมวด */}
      {visibleSections.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          บัญชีของคุณยังไม่ได้รับสิทธิ์เข้าหมวดใดเลย — กรุณาติดต่อผู้ดูแลระบบ (SUPER_ADMIN) เพื่อขอสิทธิ์
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleSections.map((sec) => (
            <SectionCard
              key={sec.permission}
              href={sec.href}
              icon={sec.icon}
              label={sec.label}
              description={sec.description}
              stat={stats[sec.permission]}
            />
          ))}
          {hasPermission(user, "FINANCE") && (
            <SectionCard
              href="/admin/account"
              icon="🏦"
              label="บัญชี"
              description="ทางลัดตรวจยอดเงินในระบบและยอดเงินบน Xendit"
              stat="ระบบ · Xendit"
              emphasized
            />
          )}
          {user.role === "SUPER_ADMIN" && (
            <SectionCard
              href="/admin/users"
              icon="👥"
              label="ผู้ดูแลระบบ"
              description="เพิ่ม / แก้ Role / กำหนดสิทธิ์เข้าถึงแต่ละหมวด"
              stat="เฉพาะ SUPER_ADMIN"
              emphasized
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        highlight
          ? "border-yellow-400 bg-yellow-50"
          : "border-green-100 bg-white"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-green-900">{value}</p>
    </div>
  );
}

function SectionCard({
  href,
  icon,
  label,
  description,
  stat,
  emphasized,
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
  stat?: string;
  emphasized?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex h-full flex-col justify-between rounded-xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        emphasized
          ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-white"
          : "border-slate-200 bg-white hover:border-green-300"
      }`}
    >
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-2xl group-hover:bg-green-100"
          >
            {icon}
          </span>
          <h2 className="text-base font-bold text-green-900">{label}</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-500">
          {stat ?? "เปิดหน้า"}
        </span>
        <span
          aria-hidden
          className="text-sm font-semibold text-green-700 group-hover:text-green-900"
        >
          →
        </span>
      </div>
    </Link>
  );
}
