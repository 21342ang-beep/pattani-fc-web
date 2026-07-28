import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import CheckForm from "./CheckForm";
import DeleteBookingGateScanButton from "./DeleteBookingGateScanButton";

export const metadata = { title: "ตรวจสอบการจอง — Pattani FC Admin" };

export default async function CheckBookingPage() {
  await verifyPermission("BOOKINGS");
  const [scans, totalScans] = await Promise.all([
    prisma.bookingGateScan.findMany({
      orderBy: { scannedAt: "desc" },
      take: 100,
      select: {
        id: true,
        scannedAt: true,
        scannedBy: true,
        booking: {
          select: {
            bookingCode: true,
            customerName: true,
            match: { select: { homeTeam: true, awayTeam: true } },
          },
        },
      },
    }),
    prisma.bookingGateScan.count(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <Link
          href="/admin/bookings"
          className="text-base font-medium text-green-800 hover:underline md:text-lg"
        >
          ← กลับไปหน้าการจอง
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-green-900 md:text-4xl">สแกนใช้งานตั๋ว</h1>
        <p className="text-base text-slate-600 md:text-lg">
          ยิงบาร์โค้ดเพื่อบันทึกการใช้งานและตรวจสอบสิทธิ์เข้าชมการแข่งขัน
        </p>
      </header>
      <CheckForm />

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-green-900 md:text-3xl">ข้อมูลการใช้งานบัตรจากการสแกน</h2>
            <p className="text-base text-slate-600 md:text-lg">แสดง 100 รายการล่าสุดจากทั้งหมด {totalScans.toLocaleString("th-TH")} ครั้ง</p>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1.5 text-base font-semibold text-green-800 md:text-lg">
            สแกนแล้ว {totalScans.toLocaleString("th-TH")} ครั้ง
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-base md:text-lg">
            <thead className="border-b bg-slate-50 text-left text-sm uppercase text-slate-600 md:text-base">
              <tr>
                <th className="px-3 py-2">เวลาสแกน</th>
                <th className="px-3 py-2">รหัสการจอง</th>
                <th className="px-3 py-2">ผู้จอง</th>
                <th className="px-3 py-2">แมตช์</th>
                <th className="px-3 py-2">ผู้สแกน</th>
                <th className="px-3 py-2 text-right">ทดสอบ</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDateTime(scan.scannedAt)}</td>
                  <td className="px-3 py-2 font-mono text-sm md:text-base">{scan.booking.bookingCode}</td>
                  <td className="px-3 py-2 font-medium">{scan.booking.customerName}</td>
                  <td className="px-3 py-2">{scan.booking.match.homeTeam} vs {scan.booking.match.awayTeam}</td>
                  <td className="px-3 py-2 font-mono text-sm text-slate-500 md:text-base">{scan.scannedBy}</td>
                  <td className="px-3 py-2 text-right"><DeleteBookingGateScanButton scanId={scan.id} /></td>
                </tr>
              ))}
              {scans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">ยังไม่มีข้อมูลการสแกนใช้งานบัตร</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
