import Link from "next/link";
import { formatBaht, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายการชำระเงินที่ระบบยังยืนยันไม่ได้ — Pattani FC Admin" };

const bookingStatusLabel: Record<string, string> = {
  PENDING: "รอชำระ / รอตรวจสอบ",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  REFUNDED: "ทำเครื่องหมายคืนเงินแล้ว",
};

const bookingStatusStyle: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-700",
  REFUNDED: "bg-blue-100 text-blue-800",
};

type ReviewRow = {
  key: string;
  provider: "Beam" | "Xendit";
  providerId: string | null;
  referenceId: string;
  amount: number;
  createdAt: Date;
  booking: {
    id: string;
    bookingCode: string;
    customerName: string;
    status: string;
    quantity: number;
    zone: string | null;
    totalAmount: number;
    match: {
      homeTeam: string;
      awayTeam: string;
      kickoffAt: Date | null;
    };
  };
};

export default async function BookingPaymentReviewPage() {
  await verifyPermission("BOOKINGS");

  const [beamPayments, xenditPayments] = await Promise.all([
    prisma.beamPayment.findMany({
      where: { status: "REVIEW_REQUIRED", bookingId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        chargeId: true,
        referenceId: true,
        amount: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            bookingCode: true,
            customerName: true,
            status: true,
            quantity: true,
            zone: true,
            totalAmount: true,
            match: {
              select: { homeTeam: true, awayTeam: true, kickoffAt: true },
            },
          },
        },
      },
    }),
    prisma.xenditPayment.findMany({
      where: { status: "REVIEW_REQUIRED", bookingId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        paymentId: true,
        paymentRequestId: true,
        referenceId: true,
        amount: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            bookingCode: true,
            customerName: true,
            status: true,
            quantity: true,
            zone: true,
            totalAmount: true,
            match: {
              select: { homeTeam: true, awayTeam: true, kickoffAt: true },
            },
          },
        },
      },
    }),
  ]);

  const rows: ReviewRow[] = [
    ...beamPayments.flatMap((payment) => payment.booking
      ? [{
          key: `beam-${payment.id}`,
          provider: "Beam" as const,
          providerId: payment.chargeId,
          referenceId: payment.referenceId,
          amount: payment.amount,
          createdAt: payment.createdAt,
          booking: payment.booking,
        }]
      : []),
    ...xenditPayments.flatMap((payment) => payment.booking
      ? [{
          key: `xendit-${payment.id}`,
          provider: "Xendit" as const,
          providerId: payment.paymentId ?? payment.paymentRequestId,
          referenceId: payment.referenceId,
          amount: payment.amount,
          createdAt: payment.createdAt,
          booking: payment.booking,
        }]
      : []),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/bookings" className="font-semibold text-green-800 hover:underline">
          ← กลับหน้าการจอง
        </Link>
        <h1 className="mt-3 text-3xl font-black text-green-900 md:text-4xl">
          รายการชำระเงินที่ระบบยังยืนยันไม่ได้
        </h1>
        <p className="mt-2 text-base text-slate-600 md:text-lg">
          พบ {rows.length.toLocaleString("th-TH")} รายการที่ระบบเก็บหลักฐานไว้ แต่ยังไม่ยืนยันการจองอัตโนมัติ
        </p>
      </header>

      <section role="alert" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950 shadow-sm">
        <h2 className="text-lg font-black">ตรวจสอบกับผู้ให้บริการก่อนทุกครั้ง</h2>
        <p className="mt-2 leading-7">
          ห้ามเปลี่ยนสถานะเป็นยืนยันชำระหรือคืนเงินจากหน้าการจองโดยตรง
          จนกว่าจะตรวจเลขอ้างอิง ยอดเงิน เวลารับชำระ และรายการคืนเงินหรือยกเลิกยอดกับผู้ให้บริการครบถ้วน
          หากข้อมูลตรงกัน ให้ติดต่อผู้ดูแลระบบเพื่อกระทบยอดพร้อมบันทึกประวัติการแก้ไข
        </p>
      </section>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-900">
          <p className="text-lg font-bold">ไม่มีรายการจองที่ต้องตรวจสอบในขณะนี้</p>
          <p className="mt-1 text-sm">ระบบจะแสดงรายการใหม่ที่ต้องตรวจสอบบนหน้านี้โดยอัตโนมัติ</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">รายการจอง</th>
                  <th className="px-4 py-3">ผู้ให้บริการ</th>
                  <th className="px-4 py-3 text-right">ยอดในรายการชำระ</th>
                  <th className="px-4 py-3">สถานะการจอง</th>
                  <th className="px-4 py-3">สร้างรายการชำระเมื่อ</th>
                  <th className="px-4 py-3 text-right">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const amountMismatch = row.amount !== row.booking.totalAmount;
                  return (
                    <tr key={row.key} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-4">
                        <p className="font-bold text-green-950">{row.booking.customerName}</p>
                        <p className="font-mono text-xs text-slate-500">{row.booking.bookingCode}</p>
                        <p className="mt-1 text-slate-600">
                          {row.booking.match.homeTeam} vs {row.booking.match.awayTeam}
                        </p>
                        <p className="text-xs text-slate-500">
                          โซน {row.booking.zone ?? "—"} · {row.booking.quantity.toLocaleString("th-TH")} ใบ
                          {row.booking.match.kickoffAt
                            ? ` · ${formatDateTime(row.booking.match.kickoffAt)}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">
                          {row.provider}
                        </span>
                        <p className="mt-2 max-w-72 break-all font-mono text-xs text-slate-600">
                          Ref: {row.referenceId}
                        </p>
                        {row.providerId && (
                          <p className="mt-1 max-w-72 break-all font-mono text-xs text-slate-400">
                            Provider ID: {row.providerId}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-black text-slate-900">{formatBaht(row.amount)}</p>
                        {amountMismatch && (
                          <p className="mt-1 text-xs font-bold text-red-700">
                            ยอดการจอง {formatBaht(row.booking.totalAmount)} ไม่ตรงกัน
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${bookingStatusStyle[row.booking.status] ?? "bg-slate-100 text-slate-700"}`}>
                          {bookingStatusLabel[row.booking.status] ?? "ไม่ทราบสถานะ"}
                        </span>
                        <p className="mt-2 text-xs font-semibold text-amber-800">รอตรวจสอบหลักฐานการชำระ</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/bookings/${row.booking.id}`}
                          className="inline-flex rounded-lg border border-green-700 px-3 py-2 font-bold text-green-800 hover:bg-green-50"
                        >
                          เปิดรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
