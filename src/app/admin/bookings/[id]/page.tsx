import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import BookingStatusSelect from "../BookingStatusSelect";
import DeleteBookingButton from "../DeleteBookingButton";

export const dynamic = "force-dynamic";

const actionLabel: Record<string, string> = {
  STAFF_CREATED: "ทีมงานสร้างรายการ",
  DETAILS_UPDATED: "แก้ไขข้อมูลการจอง",
  STATUS_CHANGED: "เปลี่ยนสถานะ",
  DELETED: "ลบรายการที่ยกเลิก",
};

const bookingStatusLabel: Record<string, string> = {
  PENDING: "รอชำระ",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  REFUNDED: "ทำเครื่องหมายคืนเงินแล้ว",
};

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyPermission("BOOKINGS");
  const { id } = await params;
  if (!/^[a-z0-9]+$/i.test(id)) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true, venue: true, status: true } },
      auditLogs: { orderBy: { createdAt: "desc" } },
      beamPayments: {
        where: { status: { in: ["SUCCEEDED", "REVIEW_REQUIRED"] } },
        select: { id: true, status: true },
      },
      xenditPayments: {
        where: { status: { in: ["SUCCEEDED", "REVIEW_REQUIRED"] } },
        select: { id: true, status: true },
      },
      _count: { select: { gateScans: true } },
    },
  });
  if (!booking) notFound();

  const paymentNeedsReview = [...booking.beamPayments, ...booking.xenditPayments]
    .some((payment) => payment.status === "REVIEW_REQUIRED");
  const onlinePaymentVerified = [...booking.beamPayments, ...booking.xenditPayments]
    .some((payment) => payment.status === "SUCCEEDED");
  const canChangeZone =
    booking.status === "CONFIRMED" &&
    booking.paidAt != null &&
    booking.zone != null &&
    booking.seatNumbers.length === 0 &&
    booking.scannedAt == null &&
    booking._count.gateScans === 0 &&
    (booking.salesChannel === "STAFF" || onlinePaymentVerified) &&
    booking.match.status !== "CANCELLED" &&
    booking.match.status !== "FINISHED" &&
    booking.match.kickoffAt != null &&
    booking.match.kickoffAt > new Date();

  const seller = booking.soldById
    ? await prisma.user.findUnique({ where: { id: booking.soldById }, select: { name: true, email: true } })
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link href="/admin/bookings" className="font-medium text-green-800 hover:underline">← กลับหน้าการจอง</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-green-900">รายการ {booking.bookingCode}</h1>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {paymentNeedsReview ? (
              <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                ล็อกสถานะไว้เพื่อตรวจสอบการชำระเงิน
              </span>
            ) : (
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                สถานะ
                <BookingStatusSelect bookingId={booking.id} currentStatus={booking.status} />
              </label>
            )}
            {booking.status !== "CANCELLED" && booking.status !== "REFUNDED" && (
              <Link href={`/admin/bookings/${booking.id}/edit`} className="rounded-lg bg-green-800 px-4 py-2.5 font-bold text-yellow-300 hover:bg-green-900">แก้ไขข้อมูล</Link>
            )}
            {canChangeZone && (
              <Link href={`/admin/bookings/${booking.id}/change-zone`} className="rounded-lg bg-violet-700 px-4 py-2.5 font-bold text-white hover:bg-violet-800">เปลี่ยนโซน</Link>
            )}
            <DeleteBookingButton
              bookingId={booking.id}
              bookingCode={booking.bookingCode}
              status={booking.status}
              redirectTo="/admin/bookings"
              detailView
            />
          </div>
        </div>
      </header>

      {paymentNeedsReview && (
        <section role="alert" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <h2 className="text-lg font-black">รายการนี้ยังยืนยันการชำระเงินอัตโนมัติไม่ได้</h2>
          <p className="mt-1 leading-7">
            ระบบล็อกการเปลี่ยนสถานะด้วยมือเพื่อป้องกันการยืนยันหรือคืนเงินผิดรายการ
            กรุณาตรวจยอด เลขอ้างอิง เวลารับชำระ และประวัติคืนเงินกับผู้ให้บริการก่อน
          </p>
          <Link
            href="/admin/bookings/review"
            className="mt-3 inline-flex rounded-lg border border-amber-500 bg-white px-3 py-2 text-sm font-bold hover:bg-amber-100"
          >
            เปิดรายการที่ต้องตรวจสอบ
          </Link>
        </section>
      )}

      <section className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="ลูกค้า" value={booking.customerName} />
        <Detail label="เบอร์โทรศัพท์" value={booking.customerPhone} />
        <Detail label="อีเมล" value={booking.customerEmail || "—"} />
        <Detail label="แมตช์" value={`${booking.match.homeTeam} vs ${booking.match.awayTeam}`} />
        <Detail label="วันแข่งขัน" value={booking.match.kickoffAt ? formatDateTime(booking.match.kickoffAt) : "ยังไม่กำหนด"} />
        <Detail label="สนาม" value={booking.match.venue || "—"} />
        <Detail label="โซน / จำนวน" value={`${booking.zone || "—"} / ${booking.quantity} ใบ`} />
        <Detail label="ยอดรวม" value={formatBaht(booking.totalAmount)} />
        <Detail label="สถานะ" value={bookingStatusLabel[booking.status] ?? booking.status} />
        <Detail label="ช่องทาง" value={booking.salesChannel === "STAFF" ? "จองโดยทีมงาน" : "เว็บไซต์"} />
        <Detail label="การรับเงิน" value={paymentLabel(booking.paymentMethod)} />
        <Detail label="เลขอ้างอิง" value={booking.offlineReceiptNo || "—"} />
        <Detail label="ผู้ทำรายการ" value={seller ? seller.name || seller.email : "—"} />
        <Detail label="สร้างเมื่อ" value={formatDateTime(booking.createdAt)} />
        <Detail label="หมายเหตุ" value={booking.notes || "—"} />
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-green-900">ประวัติรายการ</h2>
        <div className="mt-4 space-y-3">
          {booking.auditLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{actionLabel[log.action] || log.action}</p>
                  <p className="text-sm text-slate-600">โดย {log.actorLabel}</p>
                </div>
                <time className="text-sm text-slate-500">{formatDateTime(log.createdAt)}</time>
              </div>
              {(log.previousStatus || log.nextStatus) && (
                <p className="mt-2 text-sm text-slate-700">
                  {log.previousStatus ? bookingStatusLabel[log.previousStatus] ?? log.previousStatus : "—"}
                  {" → "}
                  {log.nextStatus ? bookingStatusLabel[log.nextStatus] ?? log.nextStatus : "—"}
                </p>
              )}
              {auditChanges(log.details).map((change) => (
                <p key={change} className="mt-1 text-sm text-slate-600">{change}</p>
              ))}
            </div>
          ))}
          {booking.auditLogs.length === 0 && <p className="text-slate-500">รายการเดิมยังไม่มีประวัติในระบบ</p>}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-base font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function paymentLabel(method: string | null) {
  if (method === "OFFLINE_CASH") return "เงินสด";
  if (method === "OFFLINE_TRANSFER") return "โอนเงิน";
  return method || "รอชำระ";
}

function auditChanges(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const changes = (details as Record<string, unknown>).changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  const labels: Record<string, string> = {
    customerName: "ชื่อ",
    customerPhone: "เบอร์โทรศัพท์",
    customerEmail: "อีเมล",
    notes: "หมายเหตุ",
    zone: "โซน",
    quantity: "จำนวน",
    totalAmount: "ยอดเงิน (สตางค์)",
  };
  return Object.entries(changes as Record<string, unknown>).flatMap(([field, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    return [`${labels[field] || field}: ${displayAuditValue(row.from)} → ${displayAuditValue(row.to)}`];
  });
}

function displayAuditValue(value: unknown) {
  return value === null || value === "" || value === undefined ? "—" : String(value);
}
