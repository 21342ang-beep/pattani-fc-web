import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/format";
import { getAdminUser, hasPermission } from "@/lib/dal";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";
import { getActiveTicketCountForMatches } from "@/lib/seat-availability";
import {
  getTicketPurchaseSettings,
  isMatchTicketBookingOpen,
} from "@/lib/ticket-purchase-settings";
import type { Permission } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getAdminUser();

  const canViewMatches = hasPermission(user, "MATCHES");
  const canViewBookings = hasPermission(user, "BOOKINGS");
  const canViewSeasonPasses = hasPermission(user, "SEASON_PASSES");
  const canViewRevenue =
    hasPermission(user, "REPORTS") || hasPermission(user, "FINANCE");
  const canViewCustomers =
    hasPermission(user, "CUSTOMERS") || hasPermission(user, "MEMBER_DATA");

  const activeTicketCountPromise = canViewBookings
    ? Promise.all([
        prisma.match.findMany({
          where: { status: "ON_SALE" },
          select: { id: true, competitionType: true },
        }),
        getTicketPurchaseSettings(),
      ]).then(([matches, settings]) =>
        getActiveTicketCountForMatches(
          matches.filter((match) => isMatchTicketBookingOpen(match, settings)),
        ),
      )
    : Promise.resolve(null);
  const paymentReviewPromise = Promise.all([
    canViewBookings
      ? prisma.beamPayment.count({
          where: { status: "REVIEW_REQUIRED", bookingId: { not: null } },
        })
      : Promise.resolve(0),
    canViewBookings
      ? prisma.xenditPayment.count({
          where: { status: "REVIEW_REQUIRED", bookingId: { not: null } },
        })
      : Promise.resolve(0),
    canViewSeasonPasses
      ? prisma.beamPayment.count({
          where: {
            status: "REVIEW_REQUIRED",
            OR: [
              { seasonPassOrderId: { not: null } },
              { seasonPassPurchaseId: { not: null } },
            ],
          },
        })
      : Promise.resolve(0),
    canViewSeasonPasses
      ? prisma.xenditPayment.count({
          where: {
            status: "REVIEW_REQUIRED",
            OR: [
              { seasonPassOrderId: { not: null } },
              { seasonPassPurchaseId: { not: null } },
            ],
          },
        })
      : Promise.resolve(0),
  ]).then(([beamBooking, xenditBooking, beamSeason, xenditSeason]) => ({
    booking: beamBooking + xenditBooking,
    season: beamSeason + xenditSeason,
  }));

  // อย่าดึงหรือแสดงสถิติที่อยู่นอก permission ของผู้ดูแล แม้จะเป็น dashboard
  const [matchSummary, activeTicketCount, revenue, customerCount, paymentReview] =
    await Promise.all([
      canViewMatches
        ? Promise.all([
            prisma.match.count(),
            prisma.match.count({ where: { status: "ON_SALE" } }),
          ])
        : Promise.resolve(null),
      activeTicketCountPromise,
      canViewRevenue
        ? prisma.booking.aggregate({
            where: { status: "CONFIRMED" },
            _sum: { totalAmount: true },
          })
        : Promise.resolve(null),
      canViewCustomers ? prisma.customer.count() : Promise.resolve(null),
      paymentReviewPromise,
    ]);
  const paymentReviewTotal = paymentReview.booking + paymentReview.season;

  // สถิติเสริมต่อการ์ด — SUPER_ADMIN เห็นเสมอ, ADMIN เห็นเฉพาะที่มีสิทธิ์
  const stats: Partial<Record<Permission, string>> = {};
  if (matchSummary) {
    stats.MATCHES = `${matchSummary[0]} แมตช์ · ${matchSummary[1]} เปิดขาย`;
  }
  if (activeTicketCount != null) stats.BOOKINGS = `${activeTicketCount} ใบ active`;
  if (customerCount != null) stats.CUSTOMERS = `${customerCount} บัญชี`;
  if (revenue) stats.REPORTS = `ยอดยืนยัน ${formatBaht(revenue._sum.totalAmount ?? 0)}`;

  const canManageBarcodes = hasPermission(user, "BARCODE_MANAGEMENT");
  const canReportMatchResults = hasPermission(user, "MATCH_RESULTS");
  const canViewMemberData = hasPermission(user, "MEMBER_DATA");
  const canViewAccount = hasPermission(user, "ACCOUNT");
  const hasSpecialDashboardCard =
    canManageBarcodes ||
    canReportMatchResults ||
    canViewMemberData ||
    canViewAccount;
  const visibleSections = ADMIN_SECTIONS.filter(
    (s) => s.permission !== "GATE_CHECK" && hasPermission(user, s.permission),
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-green-900">ภาพรวมหลังบ้าน</h1>
        <p className="mt-1 text-sm text-slate-600">
          สวัสดี {user.name || user.email} · เลือกหมวดที่ต้องการจัดการได้จากการ์ดด้านล่าง
        </p>
      </div>

      {paymentReviewTotal > 0 && (
        <section
          role="alert"
          className="mb-8 rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950 shadow-sm"
        >
          <h2 className="text-lg font-bold">
            พบรายการชำระเงินที่ต้องตรวจสอบ {paymentReviewTotal.toLocaleString("th-TH")} รายการ
          </h2>
          <p className="mt-1 text-sm leading-6">
            ระบบเก็บหลักฐานไว้และจะไม่ยืนยันการชำระเงินรายการเหล่านี้อัตโนมัติ
            กรุณาตรวจยอดกับผู้ให้บริการก่อนแก้สถานะหรือคืนเงิน
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            {paymentReview.booking > 0 && canViewBookings && (
              <Link
                href="/admin/bookings"
                className="rounded-lg border border-amber-400 bg-white px-3 py-2 hover:bg-amber-100"
              >
                รายแมตช์ {paymentReview.booking.toLocaleString("th-TH")}
              </Link>
            )}
            {paymentReview.season > 0 && canViewSeasonPasses && (
              <Link
                href="/admin/season-passes"
                className="rounded-lg border border-amber-400 bg-white px-3 py-2 hover:bg-amber-100"
              >
                บัตรรายปี {paymentReview.season.toLocaleString("th-TH")}
              </Link>
            )}
          </div>
        </section>
      )}

      {/* สรุปตัวเลขรวม — แสดงเฉพาะข้อมูลที่บัญชีนี้มีสิทธิ์ */}
      {(matchSummary || activeTicketCount != null || revenue) && (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {matchSummary && (
            <>
              <StatPill label="แมตช์ทั้งหมด" value={matchSummary[0].toLocaleString("th-TH")} />
              <StatPill
                label="เปิดจองอยู่"
                value={matchSummary[1].toLocaleString("th-TH")}
                highlight
              />
            </>
          )}
          {activeTicketCount != null && (
            <StatPill label="การจอง active" value={activeTicketCount.toLocaleString("th-TH")} />
          )}
          {revenue && (
            <StatPill
              label="ยอดยืนยัน"
              value={formatBaht(revenue._sum.totalAmount ?? 0)}
            />
          )}
        </div>
      )}

      {/* การ์ดแต่ละหมวด */}
      {visibleSections.length === 0 && !hasSpecialDashboardCard ? (
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
          {canManageBarcodes && (
            <SectionCard
              href="/admin/barcodes"
              icon="▥"
              label="จัดการบาร์โค้ด"
              description="รันบาร์โค้ดสำหรับเข้างาน และสร้างบาร์โค้ดใหม่"
              stat="รัน · สร้างบาร์โค้ด"
              emphasized
            />
          )}
          {canReportMatchResults && (
            <SectionCard
              href="/admin/results"
              icon="⚽"
              label="รายงานผลการแข่งขัน"
              description="บันทึกสกอร์การแข่งขันและเผยแพร่ผลให้แฟนบอลดูบนเว็บไซต์"
              stat="บันทึกผลการแข่งขัน"
              emphasized
            />
          )}
          {canViewMemberData && (
            <SectionCard
              href="/admin/members"
              icon="👤"
              label="ข้อมูลผู้ใช้งาน"
              description="ดูข้อมูลผู้ที่สมัครสมาชิกกับสโมสร รวมถึงอีเมล เบอร์โทร และวันที่สมัคร"
              stat={`${(customerCount ?? 0).toLocaleString("th-TH")} บัญชีสมาชิก`}
              emphasized
            />
          )}
          {canViewAccount && (
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
      className={`rounded-xl border p-5 shadow-sm sm:p-6 ${
        highlight
          ? "border-yellow-400 bg-yellow-50"
          : "border-green-100 bg-white"
      }`}
    >
      <p className="text-sm text-slate-500 sm:text-base">{label}</p>
      <p className="mt-1 text-3xl font-bold text-green-900 sm:text-4xl">{value}</p>
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
      className={`group flex h-full flex-col justify-between rounded-xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${
        emphasized
          ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-white"
          : "border-slate-200 bg-white hover:border-green-300"
      }`}
    >
      <div>
        <div className="mb-4 flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-3xl group-hover:bg-green-100 sm:size-14"
          >
            {icon}
          </span>
          <h2 className="text-xl font-bold text-green-900 sm:text-2xl">{label}</h2>
        </div>
        <p className="text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm font-medium text-slate-500 sm:text-base">
          {stat ?? "เปิดหน้า"}
        </span>
        <span
          aria-hidden
          className="text-lg font-semibold text-green-700 group-hover:text-green-900"
        >
          →
        </span>
      </div>
    </Link>
  );
}
