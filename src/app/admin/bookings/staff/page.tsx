import Link from "next/link";
import { activeBookingStatusWhere, expirePendingBookings } from "@/lib/booking-expiry";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { isPattaniHomeTeam } from "@/lib/season-pass-home-match";
import {
  getZoneCapacity,
  getZoneCapacityScope,
  getZonePrice,
  STADIUM_ZONES,
  STADIUM_ZONE_CODES,
} from "@/lib/stadium-zones";
import StaffMatchBookingForm from "./StaffMatchBookingForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "จองตั๋วรายแมตช์โดยทีมงาน — Admin" };

export default async function StaffMatchBookingPage() {
  await verifyPermission("BOOKINGS");
  const matches = (await prisma.match.findMany({
    where: { status: "ON_SALE" },
    orderBy: [{ kickoffAt: "asc" }, { createdAt: "asc" }],
    include: { ticketZones: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  })).filter((match) => isPattaniHomeTeam(match.homeTeam));

  const matchIds = matches.map((match) => match.id);
  await expirePendingBookings({ matchIds });
  const bookingGroups = matchIds.length === 0 ? [] : await prisma.booking.groupBy({
    by: ["matchId", "zone"],
    where: { matchId: { in: matchIds }, ...activeBookingStatusWhere() },
    _sum: { quantity: true },
  });
  const booked = new Map(bookingGroups.map((group) => [`${group.matchId}:${group.zone ?? ""}`, group._sum.quantity ?? 0]));

  const options = matches.map((match) => {
    const legacyZones = STADIUM_ZONE_CODES.flatMap((code) => {
      const capacity = getZoneCapacity(match, code);
      const price = getZonePrice(match, code);
      if (capacity == null || capacity <= 0 || price == null || price <= 0) return [];
      const scope = getZoneCapacityScope(match, code);
      const used = scope.reduce((sum, item) => sum + (booked.get(`${match.id}:${item}`) ?? 0), 0);
      return [{ code, name: STADIUM_ZONES[code].label, price, remaining: Math.max(0, capacity - used) }];
    });
    const dynamicZones = match.ticketZones.map((zone) => ({
      code: zone.code,
      name: zone.name,
      price: zone.price,
      remaining: Math.max(0, zone.capacity - (booked.get(`${match.id}:${zone.code}`) ?? 0)),
    }));
    return {
      id: match.id,
      label: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffLabel: match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่งขัน",
      venue: match.venue,
      zones: [...legacyZones, ...dynamicZones],
    };
  }).filter((match) => match.zones.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link href="/admin/bookings" className="text-base font-medium text-green-800 hover:underline">← กลับหน้าการจอง</Link>
        <h1 className="mt-2 text-3xl font-bold text-green-900 md:text-4xl">สร้างการจองโดยทีมงาน</h1>
        <p className="mt-2 text-base text-slate-600 md:text-lg">สำหรับลูกค้าที่ฝากจองทางโทรศัพท์ แชต หรือกับเจ้าหน้าที่ โดยตัดที่นั่งจากสต็อกเดียวกับเว็บไซต์</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <SafetyCard title="ราคาจากระบบ" detail="เจ้าหน้าที่แก้ราคาเองไม่ได้" />
        <SafetyCard title="ล็อกจำนวนที่นั่ง" detail="ป้องกันขายชนกับหน้าเว็บไซต์" />
        <SafetyCard title="บันทึกผู้ทำรายการ" detail="เก็บบัญชีผู้สร้างและผู้เปลี่ยนสถานะ" />
      </div>

      <StaffMatchBookingForm matches={options} />
    </div>
  );
}

function SafetyCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="font-bold text-emerald-900">{title}</p>
      <p className="mt-1 text-sm text-emerald-800">{detail}</p>
    </div>
  );
}
