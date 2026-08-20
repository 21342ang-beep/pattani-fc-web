import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { activeBookingStatusWhere } from "@/lib/booking-expiry";
import { verifyPermission } from "@/lib/dal";
import { formatBaht } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  getMatchZoneLabel,
  getZoneCapacity,
  getZoneCapacityScope,
  getZonePrice,
  STADIUM_ZONE_CODES,
} from "@/lib/stadium-zones";
import BookingZoneChangeForm from "./BookingZoneChangeForm";

export const dynamic = "force-dynamic";

type ZoneOption = {
  code: string;
  name: string;
  price: number;
  capacity: number;
  capacityScope: string[];
};

export default async function AdminBookingZoneChangePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyPermission("BOOKINGS");
  const { id } = await params;
  if (!/^[a-z0-9]+$/i.test(id)) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      match: {
        include: {
          ticketZones: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          zoneLabels: { select: { code: true, label: true } },
        },
      },
      beamPayments: { where: { status: "SUCCEEDED" }, select: { id: true }, take: 1 },
      xenditPayments: { where: { status: "SUCCEEDED" }, select: { id: true }, take: 1 },
      _count: { select: { gateScans: true } },
    },
  });
  if (!booking) notFound();

  const currentZone = booking.zone;
  const onlinePaymentVerified = booking.beamPayments.length > 0 || booking.xenditPayments.length > 0;
  const canChangeZone =
    booking.status === "CONFIRMED" &&
    booking.paidAt != null &&
    currentZone != null &&
    booking.seatNumbers.length === 0 &&
    booking.scannedAt == null &&
    booking._count.gateScans === 0 &&
    (booking.salesChannel === "STAFF" || onlinePaymentVerified) &&
    booking.match.status !== "CANCELLED" &&
    booking.match.status !== "FINISHED" &&
    booking.match.kickoffAt != null &&
    booking.match.kickoffAt > new Date();
  if (!canChangeZone || currentZone == null) redirect(`/admin/bookings/${booking.id}`);
  if (booking.quantity <= 0 || booking.totalAmount % booking.quantity !== 0) {
    redirect(`/admin/bookings/${booking.id}`);
  }

  const paidUnitPrice = booking.totalAmount / booking.quantity;
  const zoneMap = new Map<string, ZoneOption>();
  for (const code of STADIUM_ZONE_CODES) {
    const capacity = getZoneCapacity(booking.match, code);
    const price = getZonePrice(booking.match, code);
    if (capacity != null && capacity > 0 && price != null && price > 0) {
      zoneMap.set(code, {
        code,
        name: getMatchZoneLabel(booking.match.zoneLabels, code),
        price,
        capacity,
        capacityScope: getZoneCapacityScope(booking.match, code),
      });
    }
  }
  for (const zone of booking.match.ticketZones) {
    if (zone.capacity > 0 && zone.price > 0) {
      zoneMap.set(zone.code, {
        code: zone.code,
        name: zone.name,
        price: zone.price,
        capacity: zone.capacity,
        capacityScope: [zone.code],
      });
    }
  }

  const soldGroups = await prisma.booking.groupBy({
    by: ["zone"],
    where: {
      id: { not: booking.id },
      matchId: booking.matchId,
      ...activeBookingStatusWhere(),
    },
    _sum: { quantity: true },
  });
  const soldByZone = new Map(soldGroups.map((group) => [group.zone, group._sum.quantity ?? 0]));
  const zones = [...zoneMap.values()]
    .filter((zone) => zone.code !== currentZone && zone.price === paidUnitPrice)
    .map((zone) => {
      const sold = zone.capacityScope.reduce((sum, code) => sum + (soldByZone.get(code) ?? 0), 0);
      return {
        code: zone.code,
        name: zone.name,
        priceLabel: formatBaht(zone.price),
        remaining: Math.max(0, zone.capacity - sold),
      };
    })
    .filter((zone) => zone.remaining >= booking.quantity);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href={`/admin/bookings/${booking.id}`} className="font-medium text-green-800 hover:underline">
          ← กลับหน้ารายละเอียด
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-green-900">เปลี่ยนโซนราคาเท่ากัน</h1>
        <p className="mt-2 text-slate-600">{booking.match.homeTeam} vs {booking.match.awayTeam}</p>
      </header>

      <section className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 sm:grid-cols-2">
        <p><strong>ลูกค้า:</strong> {booking.customerName}</p>
        <p><strong>รหัส:</strong> {booking.bookingCode}</p>
        <p><strong>โซนเดิม:</strong> {currentZone}</p>
        <p><strong>จำนวน:</strong> {booking.quantity.toLocaleString("th-TH")} ใบ</p>
        <p><strong>ราคาต่อใบ:</strong> {formatBaht(paidUnitPrice)}</p>
        <p><strong>ยอดชำระเดิม:</strong> {formatBaht(booking.totalAmount)}</p>
      </section>

      {zones.length > 0 ? (
        <BookingZoneChangeForm
          bookingId={booking.id}
          currentZone={currentZone}
          quantity={booking.quantity}
          zones={zones}
        />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <strong>ไม่มีโซนราคาเท่ากันที่มีที่นั่งเพียงพอ</strong>
          <p className="mt-1 text-sm">ระบบจะไม่อนุญาตให้เปลี่ยนไปโซนที่มีส่วนต่างราคาในขั้นตอนนี้</p>
        </div>
      )}
    </div>
  );
}
