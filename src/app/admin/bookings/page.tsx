import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { expirePendingBookings } from "@/lib/booking-expiry";
import { getBookingScanProgress } from "@/lib/booking-scan-progress";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";
import Link from "next/link";
import BookingStatusSelect from "./BookingStatusSelect";
import DeleteBookingButton from "./DeleteBookingButton";
import DeleteAllBookingsButton from "./DeleteAllBookingsButton";
import { getMatchTicketZoneButtonLabel } from "@/lib/match-ticket-zone-label";
import {
  getMatchZoneLabel,
  getStadiumZone,
  getZonePrice,
  STADIUM_ZONE_CODES,
  type StadiumZoneCode,
} from "@/lib/stadium-zones";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  REFUNDED: "bg-blue-100 text-blue-800",
};

const statusLabel: Record<string, string> = {
  PENDING: "รอชำระ",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  REFUNDED: "ทำเครื่องหมายคืนเงินแล้ว",
};

export default async function AdminBookingsPage(props: { searchParams: Promise<{ name?: string; matchId?: string; zone?: string; view?: string; usage?: string }> }) {
  await verifyPermission("BOOKINGS");
  const { name: rawName, matchId: rawMatchId, zone: rawZone, view: rawView, usage: rawUsage } = await props.searchParams;
  const customerName = rawName?.trim().slice(0, 100) ?? "";
  const requestedMatchId = rawMatchId && /^[a-z0-9_-]{1,50}$/i.test(rawMatchId) ? rawMatchId : null;
  const selectedZone = rawZone?.trim().slice(0, 50) || null;
  const showAllMatches = rawView === "all";
  const usageView = rawUsage === "completed" ? "completed" : rawUsage === "all" ? "all" : "active";
  await expirePendingBookings();
  const customerNameFilter = customerName
    ? { customerName: { contains: customerName, mode: "insensitive" as const } }
    : {};
  const customerFilter = {
    status: { not: "CANCELLED" as const },
    ...customerNameFilter,
  };
  const [bookingSummaryGroups, confirmedUsageRows] = await Promise.all([
    prisma.booking.groupBy({
      by: ["matchId", "zone", "status"],
      where: { zone: { not: null }, ...customerFilter },
      _count: { _all: true },
      _sum: { quantity: true, totalAmount: true },
    }),
    prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        zone: { not: null },
        ...customerNameFilter,
      },
      select: {
        matchId: true,
        zone: true,
        quantity: true,
        _count: { select: { gateScans: true } },
      },
    }),
  ]);
  const summaryMatchIds = [...new Set(bookingSummaryGroups.map((group) => group.matchId))];
  const summaryMatches = summaryMatchIds.length > 0
    ? await prisma.match.findMany({
        where: { id: { in: summaryMatchIds } },
        include: {
          ticketZones: {
            select: { code: true, buttonLabel: true, name: true, price: true, sortOrder: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          zoneLabels: { select: { code: true, label: true } },
        },
      })
    : [];
  const matchById = new Map(summaryMatches.map((match) => [match.id, match]));
  const zoneSummaries = new Map<string, {
    matchId: string;
    zoneCode: string;
    zoneButtonLabel: string;
    zoneName: string;
    matchLabel: string;
    kickoffAt: Date | null;
    configuredPrice: number | null;
    zoneOrder: number;
    bookings: number;
    tickets: number;
    confirmedBookings: number;
    confirmedTickets: number;
    scannedTickets: number;
    remainingTickets: number;
    pendingBookings: number;
    pendingTickets: number;
    refundedBookings: number;
    refundedTickets: number;
    confirmedAmount: number;
  }>();
  for (const group of bookingSummaryGroups) {
    if (!group.zone) continue;
    const match = matchById.get(group.matchId);
    if (!match) continue;
    const dynamicZone = match.ticketZones.find((zone) => zone.code === group.zone);
    const legacyZone = getStadiumZone(group.zone);
    const legacyCode = legacyZone ? group.zone as StadiumZoneCode : null;
    const zoneButtonLabel = dynamicZone
      ? getMatchTicketZoneButtonLabel(dynamicZone)
      : group.zone;
    const zoneName = dynamicZone?.name
      ?? (legacyCode ? getMatchZoneLabel(match.zoneLabels, legacyCode) : `โซน ${group.zone}`);
    const configuredPrice = dynamicZone?.price
      ?? (legacyCode ? getZonePrice(match, legacyCode) : null);
    const standardOrder = legacyCode ? STADIUM_ZONE_CODES.indexOf(legacyCode) : -1;
    const key = `${group.matchId}:${group.zone}`;
    const current = zoneSummaries.get(key) ?? {
      matchId: group.matchId,
      zoneCode: group.zone,
      zoneButtonLabel,
      zoneName,
      matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffAt: match.kickoffAt,
      configuredPrice,
      zoneOrder: dynamicZone?.sortOrder ?? (standardOrder >= 0 ? 100 + standardOrder : 999),
      bookings: 0,
      tickets: 0,
      confirmedBookings: 0,
      confirmedTickets: 0,
      scannedTickets: 0,
      remainingTickets: 0,
      pendingBookings: 0,
      pendingTickets: 0,
      refundedBookings: 0,
      refundedTickets: 0,
      confirmedAmount: 0,
    };
    const bookingCount = group._count._all;
    const ticketCount = group._sum.quantity ?? 0;
    current.bookings += bookingCount;
    current.tickets += ticketCount;
    if (group.status === "CONFIRMED") {
      current.confirmedBookings += bookingCount;
      current.confirmedTickets += ticketCount;
      current.confirmedAmount += group._sum.totalAmount ?? 0;
    } else if (group.status === "PENDING") {
      current.pendingBookings += bookingCount;
      current.pendingTickets += ticketCount;
    } else if (group.status === "REFUNDED") {
      current.refundedBookings += bookingCount;
      current.refundedTickets += ticketCount;
    }
    zoneSummaries.set(key, current);
  }
  for (const booking of confirmedUsageRows) {
    if (!booking.zone) continue;
    const summary = zoneSummaries.get(`${booking.matchId}:${booking.zone}`);
    if (!summary) continue;
    const progress = getBookingScanProgress(booking.quantity, booking._count.gateScans);
    summary.scannedTickets += progress.scannedTickets;
    summary.remainingTickets += progress.remainingTickets;
  }
  const orderedZoneSummaries = [...zoneSummaries.values()].sort((left, right) => {
    const leftKickoff = left.kickoffAt?.getTime() ?? 0;
    const rightKickoff = right.kickoffAt?.getTime() ?? 0;
    return rightKickoff - leftKickoff
      || left.zoneOrder - right.zoneOrder
      || left.zoneName.localeCompare(right.zoneName, "th");
  });
  const matchSummaries = summaryMatches
    .map((match) => {
      const zones = orderedZoneSummaries
        .filter((summary) => summary.matchId === match.id)
        .sort((left, right) => left.zoneOrder - right.zoneOrder || left.zoneName.localeCompare(right.zoneName, "th"));
      if (zones.length === 0) return null;
      return {
        matchId: match.id,
        matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
        kickoffAt: match.kickoffAt,
        zones,
        bookings: zones.reduce((sum, zone) => sum + zone.bookings, 0),
        tickets: zones.reduce((sum, zone) => sum + zone.tickets, 0),
        confirmedBookings: zones.reduce((sum, zone) => sum + zone.confirmedBookings, 0),
        confirmedTickets: zones.reduce((sum, zone) => sum + zone.confirmedTickets, 0),
        scannedTickets: zones.reduce((sum, zone) => sum + zone.scannedTickets, 0),
        remainingTickets: zones.reduce((sum, zone) => sum + zone.remainingTickets, 0),
        pendingBookings: zones.reduce((sum, zone) => sum + zone.pendingBookings, 0),
        pendingTickets: zones.reduce((sum, zone) => sum + zone.pendingTickets, 0),
        refundedBookings: zones.reduce((sum, zone) => sum + zone.refundedBookings, 0),
        refundedTickets: zones.reduce((sum, zone) => sum + zone.refundedTickets, 0),
        confirmedAmount: zones.reduce((sum, zone) => sum + zone.confirmedAmount, 0),
      };
    })
    .filter((summary): summary is NonNullable<typeof summary> => summary != null)
    .sort((left, right) => (right.kickoffAt?.getTime() ?? 0) - (left.kickoffAt?.getTime() ?? 0));
  const selectedMatchId = showAllMatches
    ? null
    : requestedMatchId ?? (selectedZone ? null : matchSummaries[0]?.matchId ?? null);
  const selectedMatchSummary = selectedMatchId
    ? matchSummaries.find((summary) => summary.matchId === selectedMatchId) ?? null
    : null;
  const selectedZoneSummary = selectedZone
    ? selectedMatchSummary?.zones.find((zone) => zone.zoneCode === selectedZone) ?? null
    : null;
  const tableConditions: Prisma.Sql[] = [Prisma.sql`booking."status" <> 'CANCELLED'`];
  if (customerName) {
    tableConditions.push(Prisma.sql`booking."customerName" ILIKE ${`%${customerName}%`}`);
  }
  if (selectedMatchId) {
    tableConditions.push(Prisma.sql`booking."matchId" = ${selectedMatchId}`);
  }
  if (selectedZone) {
    tableConditions.push(Prisma.sql`booking."zone" = ${selectedZone}`);
  }
  const fullyScannedCondition = Prisma.sql`
    booking."status" = 'CONFIRMED'
    AND booking."quantity" > 0
    AND COUNT(gate_scan."id") >= booking."quantity"
  `;
  const usageCondition = usageView === "completed"
    ? fullyScannedCondition
    : usageView === "all"
      ? Prisma.sql`TRUE`
      : Prisma.sql`NOT (${fullyScannedCondition})`;
  const tableBookingIds = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT booking."id"
    FROM "Booking" AS booking
    LEFT JOIN "BookingGateScan" AS gate_scan
      ON gate_scan."bookingId" = booking."id"
    WHERE ${Prisma.join(tableConditions, " AND ")}
    GROUP BY booking."id"
    HAVING ${usageCondition}
    ORDER BY booking."createdAt" DESC
    LIMIT 100
  `);
  const allBookings = await prisma.booking.findMany({
    where: { id: { in: tableBookingIds.map(({ id }) => id) } },
    orderBy: { createdAt: "desc" },
    include: {
      match: {
        select: {
          homeTeam: true,
          awayTeam: true,
          kickoffAt: true,
          ticketZones: { select: { code: true, buttonLabel: true, name: true } },
        },
      },
      beamPayments: {
        where: { status: "REVIEW_REQUIRED" },
        select: { id: true },
        take: 1,
      },
      xenditPayments: {
        where: { status: "REVIEW_REQUIRED" },
        select: { id: true },
        take: 1,
      },
      _count: { select: { gateScans: true } },
    },
  });
  const sellerIds = [...new Set(allBookings.map((booking) => booking.soldById).filter((id): id is string => Boolean(id)))];
  const sellers = sellerIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller.name || seller.email]));
  const bookings = allBookings;
  const filtersActive = customerName !== "" || requestedMatchId != null || selectedZone != null || usageView !== "active";
  const displayedSummary = bookings.reduce(
    (summary, booking) => {
      summary.tickets += booking.quantity;
      if (booking.status === "CONFIRMED") {
        const progress = getBookingScanProgress(booking.quantity, booking._count.gateScans);
        summary.confirmedBookings += 1;
        summary.confirmedTickets += booking.quantity;
        summary.scannedTickets += progress.scannedTickets;
        summary.remainingTickets += progress.remainingTickets;
        summary.confirmedAmount += booking.totalAmount;
      } else if (booking.status === "PENDING") {
        summary.pendingBookings += 1;
      }
      if (booking.beamPayments.length > 0 || booking.xenditPayments.length > 0) {
        summary.reviewRequired += 1;
      }
      return summary;
    },
    {
      tickets: 0,
      confirmedBookings: 0,
      confirmedTickets: 0,
      scannedTickets: 0,
      remainingTickets: 0,
      confirmedAmount: 0,
      pendingBookings: 0,
      reviewRequired: 0,
    },
  );
  const usageHref = (nextUsage: "active" | "completed" | "all") => {
    const query = new URLSearchParams();
    if (customerName) query.set("name", customerName);
    if (selectedMatchId) query.set("matchId", selectedMatchId);
    if (selectedZone) query.set("zone", selectedZone);
    if (showAllMatches) query.set("view", "all");
    if (nextUsage !== "active") query.set("usage", nextUsage);
    const suffix = query.toString();
    return `/admin/bookings${suffix ? `?${suffix}` : ""}#bookings`;
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-green-900/10 bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 px-5 py-6 text-white shadow-lg shadow-green-950/10 md:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-300">Match ticket operations</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">จัดการข้อมูลการจอง</h1>
            <p className="mt-2 text-base text-emerald-50/85 md:text-lg">
              ตรวจสอบยอดจอง ค้นหาลูกค้า และจัดการสถานะบัตรรายแมตช์จากหน้าเดียว
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/bookings/staff"
              className="inline-flex min-h-11 items-center rounded-lg bg-yellow-300 px-4 py-2.5 text-base font-black text-green-950 shadow-sm transition hover:bg-yellow-200"
            >
              + จองโดยทีมงาน
            </Link>
            <Link
              href="/admin/bookings/check"
              className="inline-flex min-h-11 items-center rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-base font-bold text-white transition hover:bg-white/20"
            >
              สแกนและประวัติบัตร
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-600 md:text-base">
          เครื่องมือจัดการข้อมูล <span className="font-semibold text-slate-900">ใช้กับรายการที่แสดงอยู่ในระบบ</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {displayedSummary.reviewRequired > 0 && (
            <Link
              href="/admin/bookings/review"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100"
            >
              ตรวจการชำระ {displayedSummary.reviewRequired} รายการ
            </Link>
          )}
          <a
            href="/api/admin/bookings/export"
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-900 hover:bg-green-100"
          >
            ส่งออก CSV
          </a>
          <DeleteAllBookingsButton />
        </div>
      </div>

      <section aria-label="สรุปรายการที่กำลังแสดง" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">รายการที่กำลังแสดง</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{bookings.length.toLocaleString("th-TH")}</p>
          <p className="mt-1 text-sm text-slate-500">รวม {displayedSummary.tickets.toLocaleString("th-TH")} ใบ</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">ยืนยันแล้ว</p>
          <p className="mt-2 text-3xl font-black text-emerald-900">{displayedSummary.confirmedBookings.toLocaleString("th-TH")}</p>
          <p className="mt-1 text-sm text-emerald-700">{displayedSummary.confirmedTickets.toLocaleString("th-TH")} ใบ</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-sky-700">สแกนแล้ว</p>
          <p className="mt-2 text-3xl font-black text-sky-950">{displayedSummary.scannedTickets.toLocaleString("th-TH")}</p>
          <p className="mt-1 text-sm text-sky-700">ใบที่ผ่านประตูแล้ว</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-violet-700">คงเหลือยังไม่สแกน</p>
          <p className="mt-2 text-3xl font-black text-violet-950">{displayedSummary.remainingTickets.toLocaleString("th-TH")}</p>
          <p className="mt-1 text-sm text-violet-700">ยืนยันแล้ว − สแกนแล้ว</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-700">รอชำระ</p>
          <p className="mt-2 text-3xl font-black text-amber-900">{displayedSummary.pendingBookings.toLocaleString("th-TH")}</p>
          <p className="mt-1 text-sm text-amber-700">รายการที่ยังรอดำเนินการ</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-green-700">ยอดยืนยันแล้ว</p>
          <p className="mt-2 text-3xl font-black text-green-950">{formatBaht(displayedSummary.confirmedAmount)}</p>
          <p className="mt-1 text-sm text-green-700">เฉพาะรายการที่แสดง</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3">
          <h2 className="text-xl font-black text-slate-950 md:text-2xl">ค้นหาและตัวกรอง</h2>
          <p className="mt-1 text-sm text-slate-500">ค้นหาจากชื่อผู้จอง และคงตัวกรองแมตช์หรือโซนที่เลือกไว้</p>
        </div>
        <form method="get" className="flex flex-col gap-3 md:flex-row md:items-end">
          {selectedMatchId && <input type="hidden" name="matchId" value={selectedMatchId} />}
          {selectedZone && <input type="hidden" name="zone" value={selectedZone} />}
          {showAllMatches && <input type="hidden" name="view" value="all" />}
          {usageView !== "active" && <input type="hidden" name="usage" value={usageView} />}
          <label className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-700">ชื่อลูกค้า</span>
            <input
              name="name"
              type="search"
              defaultValue={customerName}
              placeholder="พิมพ์ชื่อผู้จอง"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-base outline-none transition placeholder:text-slate-400 focus:border-green-600 focus:bg-white focus:ring-2 focus:ring-green-100"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-green-800 px-5 py-2.5 text-base font-bold text-yellow-300 transition hover:bg-green-900">
            ค้นหา
          </button>
          {filtersActive && (
            <Link href="/admin/bookings" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50">
              ล้างตัวกรอง
            </Link>
          )}
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4" aria-label="มุมมองตามการสแกน">
          <span className="mr-1 text-sm font-bold text-slate-600">แสดงรายการ:</span>
          {([
            ["active", "ยังไม่สแกนครบ"],
            ["completed", "สแกนครบแล้ว / ประวัติ"],
            ["all", "ทั้งหมด"],
          ] as const).map(([value, label]) => (
            <Link
              key={value}
              href={usageHref(value)}
              aria-current={usageView === value ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold transition ${
                usageView === value
                  ? "border-green-800 bg-green-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-green-600 hover:bg-green-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        {filtersActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
            <span className="font-semibold text-slate-500">กำลังกรอง:</span>
            {customerName && <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">ชื่อ “{customerName}”</span>}
            {selectedMatchSummary && <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800">{selectedMatchSummary.matchLabel}</span>}
            {selectedZone && <span className="rounded-full bg-violet-100 px-3 py-1 font-semibold text-violet-800">{selectedZoneSummary?.zoneName ?? `โซน ${selectedZone}`}</span>}
            {usageView !== "active" && (
              <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-800">
                {usageView === "completed" ? "สแกนครบแล้ว / ประวัติ" : "รายการทั้งหมด"}
              </span>
            )}
          </div>
        )}
      </section>

      {matchSummaries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-green-700">เลือกมุมมอง</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">สรุปตามแมตช์</h2>
              <p className="mt-1 text-sm text-slate-600">เลือกแมตช์เพื่อดูทุกโซน หรือเลือกโซนจากปุ่มด้านล่างการ์ด</p>
            </div>
            {!showAllMatches && (
              <Link href={`/admin/bookings?view=all${customerName ? `&name=${encodeURIComponent(customerName)}` : ""}${usageView !== "active" ? `&usage=${usageView}` : ""}#bookings`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-green-800 shadow-sm hover:bg-green-50">
                ดูรายการทุกแมตช์
              </Link>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2" role="tablist" aria-label="แมตช์ที่มีการจอง">
            {matchSummaries.map((summary) => {
              const selected = selectedMatchId === summary.matchId;
              const matchQuery = new URLSearchParams({ matchId: summary.matchId });
              if (customerName) matchQuery.set("name", customerName);
              if (usageView !== "active") matchQuery.set("usage", usageView);
              return (
                <div
                  key={summary.matchId}
                  className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition ${selected ? "border-green-700 ring-2 ring-green-700/20" : "border-slate-200 hover:border-green-300 hover:shadow-md"}`}
                >
                  <Link
                    href={`/admin/bookings?${matchQuery.toString()}#bookings`}
                    role="tab"
                    aria-selected={selected}
                    className={`block flex-1 p-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-700/30 ${selected ? "bg-green-50" : "bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">แมตช์</p>
                        <h3 className="mt-1 truncate text-xl font-black text-slate-950 md:text-2xl">{summary.matchLabel}</h3>
                        <p className="mt-1 text-sm text-slate-500">{summary.kickoffAt ? formatDateTime(summary.kickoffAt) : "ยังไม่กำหนดวันแข่งขัน"}</p>
                      </div>
                      {selected && <span className="shrink-0 rounded-full bg-green-800 px-3 py-1 text-xs font-bold text-white">กำลังดู</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <div className="rounded-lg bg-slate-100 p-2.5">
                        <p className="text-xs font-semibold text-slate-500">ทั้งหมด</p>
                        <p className="mt-1 text-xl font-black text-slate-900">{summary.bookings.toLocaleString("th-TH")}</p>
                        <p className="text-xs text-slate-500">รายการ</p>
                      </div>
                      <div className="rounded-lg bg-emerald-100 p-2.5">
                        <p className="text-xs font-semibold text-emerald-700">ยืนยัน</p>
                        <p className="mt-1 text-xl font-black text-emerald-900">{summary.confirmedTickets.toLocaleString("th-TH")}</p>
                        <p className="text-xs text-emerald-700">ใบ</p>
                      </div>
                      <div className="rounded-lg bg-sky-100 p-2.5">
                        <p className="text-xs font-semibold text-sky-700">สแกนแล้ว</p>
                        <p className="mt-1 text-xl font-black text-sky-900">{summary.scannedTickets.toLocaleString("th-TH")}</p>
                        <p className="text-xs text-sky-700">ใบ</p>
                      </div>
                      <div className="rounded-lg bg-violet-100 p-2.5">
                        <p className="text-xs font-semibold text-violet-700">คงเหลือ</p>
                        <p className="mt-1 text-xl font-black text-violet-900">{summary.remainingTickets.toLocaleString("th-TH")}</p>
                        <p className="text-xs text-violet-700">ยังไม่สแกน</p>
                      </div>
                      <div className="rounded-lg bg-amber-100 p-2.5">
                        <p className="text-xs font-semibold text-amber-700">รอชำระ</p>
                        <p className="mt-1 text-xl font-black text-amber-900">{summary.pendingBookings.toLocaleString("th-TH")}</p>
                        <p className="text-xs text-amber-700">รายการ</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">รวม {summary.tickets.toLocaleString("th-TH")} ใบ</span>
                      <strong className="text-base text-green-900">{formatBaht(summary.confirmedAmount)}</strong>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50 px-4 py-3" aria-label={`รายละเอียดโซน ${summary.matchLabel}`}>
                    {summary.zones.map((zone) => {
                      const zoneQuery = new URLSearchParams({ matchId: summary.matchId, zone: zone.zoneCode });
                      if (customerName) zoneQuery.set("name", customerName);
                      if (usageView !== "active") zoneQuery.set("usage", usageView);
                      const zoneSelected = selected && selectedZone === zone.zoneCode;
                      return (
                        <Link
                          key={zone.zoneCode}
                          href={`/admin/bookings?${zoneQuery.toString()}#bookings`}
                          aria-current={zoneSelected ? "page" : undefined}
                          title={`${zone.zoneName} · ยืนยัน ${zone.confirmedTickets} · สแกนแล้ว ${zone.scannedTickets} · คงเหลือ ${zone.remainingTickets} ใบ`}
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-green-700/30 ${zoneSelected ? "border-green-800 bg-green-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-green-600 hover:bg-green-50 hover:text-green-900"}`}
                        >
                          {zone.zoneButtonLabel} · เหลือ {zone.remainingTickets.toLocaleString("th-TH")}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section id="bookings" className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-4 md:px-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-green-700">ข้อมูลล่าสุด</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">
              รายละเอียดการจอง {selectedMatchSummary?.matchLabel ?? "ทุกแมตช์"}
              {selectedZone ? ` · ${selectedZoneSummary?.zoneName ?? `โซน ${selectedZone}`}` : " · ทุกโซน"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">แสดง {bookings.length.toLocaleString("th-TH")} รายการล่าสุด จากสูงสุด 100 รายการ · ไม่รวมรายการที่ยกเลิกและหมดเวลา</p>
          </div>
          {selectedZone && selectedMatchId && (
            <Link
              href={`/admin/bookings?matchId=${encodeURIComponent(selectedMatchId)}${customerName ? `&name=${encodeURIComponent(customerName)}` : ""}${usageView !== "active" ? `&usage=${usageView}` : ""}#bookings`}
              className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-bold text-green-900 hover:bg-green-100"
            >
              ดูทุกโซนของแมตช์นี้
            </Link>
          )}
        </div>
        <div className="max-h-[72vh] overflow-auto" role="tabpanel">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-left">การจอง</th>
              <th className="px-4 py-3 text-left">ลูกค้า</th>
              <th className="px-4 py-3 text-left">แมตช์ / โซน</th>
              <th className="px-4 py-3 text-right">บัตร / ยอด</th>
              <th className="px-4 py-3 text-left">ช่องทางรับเงิน</th>
              <th className="px-4 py-3 text-left">สถานะ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b, index) => {
              const scanProgress = getBookingScanProgress(b.quantity, b._count.gateScans);
              return (
                <tr key={b.id} className={`align-top transition hover:bg-green-50/60 ${index % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <Link href={`/admin/bookings/${b.id}`} className="inline-flex rounded-md bg-green-100 px-2 py-1 font-mono text-xs font-bold text-green-900 hover:bg-green-200">
                    {b.bookingCode}
                  </Link>
                  <div className="mt-2 text-xs text-slate-500">{formatDateTime(b.createdAt)}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-bold text-slate-900">{b.customerName}</div>
                  {b.customerEmail && <div className="mt-1 text-xs text-slate-500">{b.customerEmail}</div>}
                  <div className="mt-0.5 text-xs font-medium text-slate-600">{b.customerPhone}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-bold text-slate-900">{b.match.homeTeam} vs {b.match.awayTeam}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {b.match.kickoffAt ? formatDateTime(b.match.kickoffAt) : "ยังไม่กำหนดวันแข่งขัน"}
                  </div>
                  {(() => {
                    const dynamicZone = b.zone ? b.match.ticketZones.find((zone) => zone.code === b.zone) : null;
                    return dynamicZone ? (
                      <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">
                        {getMatchTicketZoneButtonLabel(dynamicZone)}
                      </span>
                    ) : (
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{b.zone || "ไม่ระบุโซน"}</span>
                    );
                  })()}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <div className="text-lg font-black text-slate-950">{b.quantity.toLocaleString("th-TH")} ใบ</div>
                  <div className="mt-1 font-bold text-green-800">{formatBaht(b.totalAmount)}</div>
                  {b.status === "CONFIRMED" && (
                    <div className="mt-2 text-xs font-semibold text-slate-600">
                      สแกนแล้ว {scanProgress.scannedTickets.toLocaleString("th-TH")} · เหลือ {scanProgress.remainingTickets.toLocaleString("th-TH")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {b.salesChannel === "STAFF" ? (
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">ทีมงาน</span>
                      <div className="text-xs font-medium text-slate-700">
                        {b.paymentMethod === "OFFLINE_CASH" ? "เงินสด" : b.paymentMethod === "OFFLINE_TRANSFER" ? "โอนเงิน" : "รอชำระ"}
                      </div>
                      {b.offlineReceiptNo && <div className="text-xs text-slate-500">อ้างอิง: {b.offlineReceiptNo}</div>}
                      <div className="text-xs text-slate-500">โดย {b.soldById ? sellerById.get(b.soldById) ?? "บัญชีเดิม" : "—"}</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">เว็บไซต์</span>
                      {b.paymentMethod && <div className="text-xs text-slate-500">{b.paymentMethod}</div>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col items-start gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColor[b.status]}`}>
                      {statusLabel[b.status] ?? b.status}
                    </span>
                    {b.beamPayments.length > 0 || b.xenditPayments.length > 0 ? (
                      <Link
                        href="/admin/bookings/review"
                        className="max-w-40 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold leading-snug text-amber-900 hover:bg-amber-100"
                      >
                        ล็อกไว้ตรวจการชำระ
                      </Link>
                    ) : (
                      <BookingStatusSelect bookingId={b.id} currentStatus={b.status} />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex flex-col items-end gap-2">
                    {b.status !== "CANCELLED" && b.status !== "REFUNDED" && (
                      <Link href={`/admin/bookings/${b.id}/edit`} className="whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100">
                        แก้ไข
                      </Link>
                    )}
                    <Link href={`/admin/bookings/${b.id}`} className="whitespace-nowrap rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-900 hover:bg-green-100">
                      รายละเอียด/ประวัติ
                    </Link>
                    <DeleteBookingButton
                      bookingId={b.id}
                      bookingCode={b.bookingCode}
                      status={b.status}
                    />
                  </div>
                </td>
                </tr>
              );
            })}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center">
                  <div className="mx-auto max-w-sm rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
                    <p className="text-lg font-bold text-slate-700">
                      {usageView === "completed" ? "ยังไม่มีรายการที่สแกนครบ" : "ไม่พบข้อมูลการจอง"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {usageView === "completed" ? "เมื่อใช้สิทธิ์ครบ รายการจะมาอยู่ในประวัตินี้" : "ลองล้างตัวกรองหรือค้นหาด้วยชื่ออื่น"}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
