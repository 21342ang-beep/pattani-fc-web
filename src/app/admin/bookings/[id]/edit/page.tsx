import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyPermission } from "@/lib/dal";
import { formatBaht } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  getZoneCapacity,
  getMatchZoneLabel,
  getZonePrice,
  STADIUM_ZONE_CODES,
} from "@/lib/stadium-zones";
import BookingEditForm from "./BookingEditForm";

export const dynamic = "force-dynamic";

export default async function AdminBookingEditPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyPermission("BOOKINGS");
  const { id } = await params;
  if (!/^[a-z0-9]+$/i.test(id)) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      match: {
        include: {
          ticketZones: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          zoneLabels: { select: { code: true, label: true } },
        },
      },
      _count: { select: { xenditPayments: true, beamPayments: true } },
    },
  });
  if (!booking) notFound();
  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") redirect(`/admin/bookings/${booking.id}`);

  const canEditInventory = booking.status === "PENDING"
    && booking.salesChannel === "STAFF"
    && booking.paymentMethod == null
    && booking._count.xenditPayments === 0
    && booking._count.beamPayments === 0;
  const legacyZones = STADIUM_ZONE_CODES.flatMap((code) => {
    const capacity = getZoneCapacity(booking.match, code);
    const price = getZonePrice(booking.match, code);
    return capacity != null && capacity > 0 && price != null && price > 0
      ? [{ code, name: getMatchZoneLabel(booking.match.zoneLabels, code), price }]
      : [];
  });
  const dynamicZones = booking.match.ticketZones.map((zone) => ({ code: zone.code, name: zone.name, price: zone.price }));
  const zones = [...legacyZones, ...dynamicZones];
  if (booking.zone && !zones.some((zone) => zone.code === booking.zone)) {
    zones.push({
      code: booking.zone,
      name: `โซนเดิม ${booking.zone} (ไม่เปิดให้เปลี่ยนกลับ)` ,
      price: booking.quantity > 0 ? Math.floor(booking.totalAmount / booking.quantity) : 0,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href={`/admin/bookings/${booking.id}`} className="font-medium text-green-800 hover:underline">← กลับหน้ารายละเอียด</Link>
        <h1 className="mt-2 text-3xl font-bold text-green-900">แก้ไขรายการ {booking.bookingCode}</h1>
        <p className="mt-2 text-slate-600">{booking.match.homeTeam} vs {booking.match.awayTeam}</p>
      </header>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <strong>ระบบจะบันทึกผู้แก้ เวลา ค่าเดิม และค่าใหม่ทุกครั้ง</strong>
        <p className="mt-1 text-sm">ราคาไม่สามารถพิมพ์เองได้ และจะคำนวณจากโซนในระบบเท่านั้น</p>
      </div>

      <BookingEditForm
        booking={{
          id: booking.id,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          customerEmail: booking.customerEmail ?? "",
          notes: booking.notes ?? "",
          zone: booking.zone ?? "",
          quantity: booking.quantity,
          totalAmountLabel: formatBaht(booking.totalAmount),
          status: booking.status,
          salesChannel: booking.salesChannel,
        }}
        zones={zones}
        canEditInventory={canEditInventory}
      />
    </div>
  );
}
