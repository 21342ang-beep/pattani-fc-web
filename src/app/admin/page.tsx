import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [matchCount, onSaleCount, bookingCount, revenue] = await Promise.all([
    prisma.match.count(),
    prisma.match.count({ where: { status: "ON_SALE" } }),
    prisma.booking.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.booking.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-green-900">ภาพรวม</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="แมตช์ทั้งหมด" value={matchCount.toString()} />
        <Stat label="เปิดจองอยู่" value={onSaleCount.toString()} highlight />
        <Stat label="การจอง active" value={bookingCount.toString()} />
        <Stat
          label="ยอดยืนยัน"
          value={formatBaht(revenue._sum.totalAmount ?? 0)}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/matches/new"
          className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-green-900"
        >
          + เพิ่มแมตช์ใหม่
        </Link>
        <Link
          href="/admin/bookings"
          className="rounded-md border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-50"
        >
          ดูการจอง
        </Link>
        <Link
          href="/admin/reports"
          className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-green-900 hover:bg-yellow-100"
        >
          รายงานยอดขาย
        </Link>
      </div>
    </div>
  );
}

function Stat({
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
