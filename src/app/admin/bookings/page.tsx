import { prisma } from "@/lib/prisma";
import { expirePendingBookings } from "@/lib/booking-expiry";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";
import Link from "next/link";
import BookingStatusSelect from "./BookingStatusSelect";
import DeleteBookingButton from "./DeleteBookingButton";
import DeleteAllBookingsButton from "./DeleteAllBookingsButton";
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

export default async function AdminBookingsPage(props: { searchParams: Promise<{ name?: string; matchId?: string; zone?: string; view?: string }> }) {
  await verifyPermission("BOOKINGS");
  const { name: rawName, matchId: rawMatchId, zone: rawZone, view: rawView } = await props.searchParams;
  const customerName = rawName?.trim().slice(0, 100) ?? "";
  const requestedMatchId = rawMatchId && /^[a-z0-9_-]{1,50}$/i.test(rawMatchId) ? rawMatchId : null;
  const selectedZone = rawZone?.trim().slice(0, 50) || null;
  const showAllMatches = rawView === "all";
  await expirePendingBookings();
  const customerFilter = {
    status: { not: "CANCELLED" as const },
    ...(customerName ? { customerName: { contains: customerName, mode: "insensitive" as const } } : {}),
  };
  const bookingSummaryGroups = await prisma.booking.groupBy({
    by: ["matchId", "zone", "status"],
    where: { zone: { not: null }, ...customerFilter },
    _count: { _all: true },
    _sum: { quantity: true, totalAmount: true },
  });
  const summaryMatchIds = [...new Set(bookingSummaryGroups.map((group) => group.matchId))];
  const summaryMatches = summaryMatchIds.length > 0
    ? await prisma.match.findMany({
        where: { id: { in: summaryMatchIds } },
        include: {
          ticketZones: {
            select: { code: true, name: true, price: true, sortOrder: true },
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
    zoneName: string;
    matchLabel: string;
    kickoffAt: Date | null;
    configuredPrice: number | null;
    zoneOrder: number;
    bookings: number;
    tickets: number;
    confirmedBookings: number;
    confirmedTickets: number;
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
    const zoneName = dynamicZone?.name
      ?? (legacyCode ? getMatchZoneLabel(match.zoneLabels, legacyCode) : `โซน ${group.zone}`);
    const configuredPrice = dynamicZone?.price
      ?? (legacyCode ? getZonePrice(match, legacyCode) : null);
    const standardOrder = legacyCode ? STADIUM_ZONE_CODES.indexOf(legacyCode) : -1;
    const key = `${group.matchId}:${group.zone}`;
    const current = zoneSummaries.get(key) ?? {
      matchId: group.matchId,
      zoneCode: group.zone,
      zoneName,
      matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffAt: match.kickoffAt,
      configuredPrice,
      zoneOrder: dynamicZone?.sortOrder ?? (standardOrder >= 0 ? 100 + standardOrder : 999),
      bookings: 0,
      tickets: 0,
      confirmedBookings: 0,
      confirmedTickets: 0,
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
  const tableFilter = {
    ...customerFilter,
    ...(selectedMatchId ? { matchId: selectedMatchId } : {}),
    ...(selectedZone ? { zone: selectedZone } : {}),
  };
  const allBookings = await prisma.booking.findMany({
    where: tableFilter,
    orderBy: { createdAt: "desc" },
    include: {
      match: {
        select: {
          homeTeam: true,
          awayTeam: true,
          kickoffAt: true,
          ticketZones: { select: { code: true, name: true } },
        },
      },
    },
    take: 100,
  });
  const sellerIds = [...new Set(allBookings.map((booking) => booking.soldById).filter((id): id is string => Boolean(id)))];
  const sellers = sellerIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller.name || seller.email]));
  const bookings = allBookings;
  const filtersActive = customerName !== "" || requestedMatchId != null || selectedZone != null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-green-900 md:text-4xl">การจอง</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings/staff"
            className="rounded-md bg-green-800 px-3 py-2 text-base font-bold text-yellow-300 hover:bg-green-900 md:text-lg"
          >
            + จองโดยทีมงาน
          </Link>
          <Link
            href="/admin/bookings/check"
            className="rounded-md border border-green-200 bg-white px-3 py-2 text-base font-medium text-green-900 hover:bg-green-50 md:text-lg"
          >
            🎫 สแกนและประวัติการใช้งานบัตร
          </Link>
          <a
            href="/api/admin/bookings/export"
            className="rounded-md border border-green-200 bg-white px-3 py-2 text-base font-medium text-green-900 hover:bg-green-50 md:text-lg"
          >
            ⬇ ส่งออก CSV
          </a>
          <DeleteAllBookingsButton />
        </div>
      </div>
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-green-100 bg-white p-4 shadow-sm">
        {selectedMatchId && <input type="hidden" name="matchId" value={selectedMatchId} />}
        {selectedZone && <input type="hidden" name="zone" value={selectedZone} />}
        {showAllMatches && <input type="hidden" name="view" value="all" />}
        <label className="min-w-64 flex-1">
          <span className="block text-base font-semibold text-green-900 md:text-lg">ค้นหาชื่อลูกค้า</span>
          <input
            name="name"
            type="search"
            defaultValue={customerName}
            placeholder="พิมพ์ชื่อผู้จอง"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-lg"
          />
        </label>
        <button type="submit" className="rounded-md bg-green-800 px-4 py-2.5 text-base font-semibold text-yellow-300 hover:bg-green-900 md:text-lg">
          ค้นหา
        </button>
        {filtersActive && <Link href="/admin/bookings" className="rounded-md border border-slate-300 px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 md:text-lg">ล้างตัวกรอง</Link>}
      </form>
      {matchSummaries.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-green-900 md:text-3xl">ข้อมูลการจองตามแมตช์</h2>
              <p className="mt-1 text-sm text-slate-600 md:text-base">เลือกการ์ดแมตช์เพื่อดูทุกโซน หรือเลือกปุ่มโซนภายในการ์ดเพื่อดูเฉพาะโซนนั้น</p>
            </div>
            {!showAllMatches && (
              <Link href={`/admin/bookings?view=all${customerName ? `&name=${encodeURIComponent(customerName)}` : ""}#bookings`} className="text-base font-medium text-green-800 hover:underline md:text-lg">
                ดูรายการทุกแมตช์
              </Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="tablist" aria-label="แมตช์ที่มีการจอง">
            {matchSummaries.map((summary) => {
              const selected = selectedMatchId === summary.matchId;
              const matchQuery = new URLSearchParams({ matchId: summary.matchId });
              if (customerName) matchQuery.set("name", customerName);
              return (
                <div
                  key={summary.matchId}
                  className={`flex h-full flex-col rounded-xl border p-4 shadow-sm transition ${selected ? "border-green-700 bg-green-50 ring-2 ring-green-700/20" : "border-green-100 bg-white"}`}
                >
                  <Link
                    href={`/admin/bookings?${matchQuery.toString()}#bookings`}
                    role="tab"
                    aria-selected={selected}
                    className="block flex-1 rounded-lg transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-green-700/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold uppercase tracking-widest text-yellow-700 md:text-base">แมตช์</p>
                        <h3 className="mt-1 text-xl font-black text-green-950 md:text-2xl">{summary.matchLabel}</h3>
                        <p className="mt-1 text-sm text-slate-500">{summary.kickoffAt ? formatDateTime(summary.kickoffAt) : "ยังไม่กำหนดวันแข่งขัน"}</p>
                      </div>
                      <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-right">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">ยืนยันแล้ว</p>
                        <strong className="block text-2xl text-emerald-800">{summary.confirmedTickets}</strong>
                        <span className="text-xs text-emerald-700">ใบ</span>
                      </div>
                    </div>
                    <p className="mt-3 text-3xl font-black text-green-900 md:text-4xl">{summary.bookings.toLocaleString("th-TH")} <span className="text-base font-medium md:text-lg">รายการ</span></p>
                    <p className="mt-1 text-sm text-slate-600 md:text-base">
                      {summary.tickets.toLocaleString("th-TH")} ใบ · ยืนยัน {summary.confirmedBookings.toLocaleString("th-TH")} รายการ · {formatBaht(summary.confirmedAmount)}
                    </p>
                    {summary.pendingBookings > 0 && (
                      <p className="mt-1 text-sm font-semibold text-amber-700">รอชำระ {summary.pendingBookings} รายการ · {summary.pendingTickets} ใบ</p>
                    )}
                  </Link>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-green-100 pt-3" aria-label={`รายละเอียดโซน ${summary.matchLabel}`}>
                    {summary.zones.map((zone) => {
                      const zoneQuery = new URLSearchParams({ matchId: summary.matchId, zone: zone.zoneCode });
                      if (customerName) zoneQuery.set("name", customerName);
                      const zoneSelected = selected && selectedZone === zone.zoneCode;
                      return (
                        <Link
                          key={zone.zoneCode}
                          href={`/admin/bookings?${zoneQuery.toString()}#bookings`}
                          aria-current={zoneSelected ? "page" : undefined}
                          title={`${zone.zoneName} · ยืนยัน ${zone.confirmedTickets} ใบ`}
                          className={`rounded-full border px-2.5 py-1 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-green-700/30 ${zoneSelected ? "border-green-800 bg-green-800 text-white" : "border-green-200 bg-white text-green-900 hover:border-green-600 hover:bg-green-100"}`}
                        >
                          {zone.zoneCode} · {zone.confirmedTickets.toLocaleString("th-TH")} ใบ
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div id="bookings" className="scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-green-900 md:text-3xl">
              รายละเอียดการจอง {selectedMatchSummary?.matchLabel ?? "ทุกแมตช์"}
              {selectedZone ? ` · ${selectedZoneSummary?.zoneName ?? `โซน ${selectedZone}`}` : " · ทุกโซน"}
            </h2>
            <p className="mt-1 text-sm text-slate-600 md:text-base">แสดงสูงสุด 100 รายการ · ไม่รวมรายการที่ยกเลิกและหมดเวลา</p>
          </div>
          {selectedZone && selectedMatchId && (
            <Link
              href={`/admin/bookings?matchId=${encodeURIComponent(selectedMatchId)}${customerName ? `&name=${encodeURIComponent(customerName)}` : ""}#bookings`}
              className="rounded-md border border-green-300 bg-white px-3 py-1.5 text-sm font-semibold text-green-900 hover:bg-green-50 md:text-base"
            >
              ดูทุกโซนของแมตช์นี้
            </Link>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm" role="tabpanel">
        <table className="w-full min-w-[1250px] text-base md:text-lg">
          <thead className="border-b bg-slate-50 text-sm uppercase md:text-base">
            <tr>
              <th className="px-3 py-2 text-left">รหัส</th>
              <th className="px-3 py-2 text-left">ลูกค้า</th>
              <th className="px-3 py-2 text-left">แมตช์</th>
              <th className="px-3 py-2 text-left">โซน</th>
              <th className="px-3 py-2 text-right">จำนวน</th>
              <th className="px-3 py-2 text-right">ยอด</th>
              <th className="px-3 py-2 text-left">ช่องทาง / รับเงิน</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="px-3 py-2 text-left">วันที่</th>
              <th className="px-3 py-2 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-sm md:text-base">{b.bookingCode}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{b.customerName}</div>
                  <div className="text-sm text-slate-500 md:text-base">{b.customerEmail}</div>
                  <div className="text-sm text-slate-500 md:text-base">{b.customerPhone}</div>
                </td>
                <td className="px-3 py-2 text-base md:text-lg">
                  <div>{b.match.homeTeam} vs {b.match.awayTeam}</div>
                  <div className="text-slate-500">
                    {b.match.kickoffAt ? formatDateTime(b.match.kickoffAt) : "—"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {(() => {
                    const dynamicZone = b.zone ? b.match.ticketZones.find((zone) => zone.code === b.zone) : null;
                    return dynamicZone ? (
                      <div>
                        <div className="font-semibold text-violet-900">{dynamicZone.name}</div>
                        <div className="text-sm text-violet-600">โซน {dynamicZone.code}</div>
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-700">{b.zone ? `โซน ${b.zone}` : "—"}</span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-right">{b.quantity}</td>
                <td className="px-3 py-2 text-right">{formatBaht(b.totalAmount)}</td>
                <td className="px-3 py-2 text-sm md:text-base">
                  {b.salesChannel === "STAFF" ? (
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-800">ทีมงาน</span>
                      <div className="text-slate-700">
                        {b.paymentMethod === "OFFLINE_CASH" ? "เงินสด" : b.paymentMethod === "OFFLINE_TRANSFER" ? "โอนเงิน" : "รอชำระ"}
                      </div>
                      {b.offlineReceiptNo && <div className="text-xs text-slate-500">อ้างอิง: {b.offlineReceiptNo}</div>}
                      <div className="text-xs text-slate-500">โดย {b.soldById ? sellerById.get(b.soldById) ?? "บัญชีเดิม" : "—"}</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-800">เว็บไซต์</span>
                      {b.paymentMethod && <div className="text-xs text-slate-500">{b.paymentMethod}</div>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-sm ${statusColor[b.status]}`}>
                      {b.status}
                    </span>
                    <BookingStatusSelect bookingId={b.id} currentStatus={b.status} />
                  </div>
                </td>
                <td className="px-3 py-2 text-sm text-slate-500 md:text-base">
                  {formatDateTime(b.createdAt)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {b.status !== "CANCELLED" && b.status !== "REFUNDED" && (
                      <Link href={`/admin/bookings/${b.id}/edit`} className="whitespace-nowrap text-sm font-semibold text-violet-700 hover:underline md:text-base">
                        แก้ไข
                      </Link>
                    )}
                    <Link href={`/admin/bookings/${b.id}`} className="whitespace-nowrap text-sm font-semibold text-green-800 hover:underline md:text-base">
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
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-500">
                  ยังไม่มีการจอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
