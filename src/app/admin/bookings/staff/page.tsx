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

const STAFF_ZONE_CATALOG = [
  { codes: ["VVIP"], name: "Zone VVIP", price: 20_000, dynamicOnly: true },
  { codes: ["A-170", "A170"], name: "Zone A 170", price: 17_000, dynamicOnly: true },
  { codes: ["A-150", "A150", "A"], name: "Zone A 150", price: 15_000 },
  { codes: ["B-170", "B170"], name: "Zone B 170", price: 17_000, dynamicOnly: true },
  { codes: ["B-150", "B150", "B"], name: "Zone B 150", price: 15_000 },
  { codes: ["C"], name: "Zone C", price: 12_000 },
  { codes: ["D"], name: "Zone D", price: 10_000 },
  { codes: ["E"], name: "Zone E", price: 12_000 },
  { codes: ["F"], name: "Zone F", price: 15_000 },
  { codes: ["G"], name: "Zone G", price: 12_000 },
  { codes: ["H", "I"], name: "Zone H", price: 10_000 },
  { codes: ["J"], name: "Zone J", price: 12_000 },
  { codes: ["AWAY"], name: "Zone AWAY", price: 20_000 },
] as const;

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
    const legacyByCode = new Map(legacyZones.map((zone) => [zone.code, zone]));
    const dynamicByCode = new Map(dynamicZones.map((zone) => [zone.code.toUpperCase(), zone]));
    const zones = STAFF_ZONE_CATALOG.map((catalogZone) => {
      const dynamicZone = catalogZone.codes
        .map((code) => dynamicByCode.get(code))
        .find((zone) => zone != null);
      const legacyZone = "dynamicOnly" in catalogZone && catalogZone.dynamicOnly
        ? undefined
        : catalogZone.codes
            .map((code) => legacyByCode.get(code as keyof typeof STADIUM_ZONES))
            .find((zone) => zone != null);
      const configuredZone = dynamicZone ?? legacyZone;
      const priceMatches = configuredZone?.price === catalogZone.price;
      return {
        code: configuredZone?.code ?? catalogZone.codes[0],
        name: catalogZone.name,
        price: catalogZone.price,
        remaining: priceMatches ? configuredZone.remaining : 0,
        available: Boolean(priceMatches && configuredZone.remaining > 0),
        unavailableReason: configuredZone
          ? priceMatches
            ? "บัตรหมด"
            : "ราคาที่ตั้งไว้ยังไม่ตรง"
          : "ยังไม่กำหนดจำนวนที่นั่ง",
      };
    });
    return {
      id: match.id,
      label: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffLabel: match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่งขัน",
      venue: match.venue,
      zones,
    };
  }).filter((match) => match.zones.some((zone) => zone.available));

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
