import Link from "next/link";
import type { SeasonPassSalesChannel } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { SEASON_TIERS, type SeasonTierId } from "@/lib/season-pass-tiers";

const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const WEEKDAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

type CalendarOrder = {
  id: string;
  passCode: string;
  tierId: string;
  seatZone: string;
  customerName: string;
  customerPhone: string;
  priceBaht: number;
  shippingFeeBaht: number;
  salesChannel: SeasonPassSalesChannel;
  soldAt: Date | null;
  createdAt: Date;
};

export default function SeasonPassSalesCalendar({
  orders,
  rawMonth,
  rawDate,
  selectedTier,
  selectedZone,
}: {
  orders: CalendarOrder[];
  rawMonth?: string;
  rawDate?: string;
  selectedTier: SeasonTierId;
  selectedZone?: string;
}) {
  const today = toBangkokDateKey(new Date());
  const currentMonth = today.slice(0, 7);
  const selectedMonth = normalizeMonth(rawMonth) ?? currentMonth;
  const selectedDate = normalizeDate(rawDate, selectedMonth);
  const [year, month] = selectedMonth.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, 15, 12)));

  const ordersByDate = new Map<string, { orders: CalendarOrder[]; revenue: number }>();
  for (const order of orders) {
    const dateKey = toBangkokDateKey(getSaleDate(order));
    if (!dateKey.startsWith(`${selectedMonth}-`)) continue;
    const summary = ordersByDate.get(dateKey) ?? { orders: [], revenue: 0 };
    summary.orders.push(order);
    summary.revenue += order.priceBaht + order.shippingFeeBaht;
    ordersByDate.set(dateKey, summary);
  }

  const monthOrders = [...ordersByDate.values()].reduce(
    (total, summary) => total + summary.orders.length,
    0,
  );
  const monthRevenue = [...ordersByDate.values()].reduce(
    (total, summary) => total + summary.revenue,
    0,
  );
  const selectedSummary = selectedDate ? ordersByDate.get(selectedDate) : undefined;
  const selectedOrders = [...(selectedSummary?.orders ?? [])].sort(
    (a, b) => getSaleDate(b).getTime() - getSaleDate(a).getTime(),
  );

  return (
    <section className="mb-6 rounded-2xl border border-green-100 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-yellow-700 md:text-base">
            ยอดขายรายวัน
          </p>
          <h2 className="mt-1 text-2xl font-black text-green-900 md:text-3xl">
            ปฏิทินการจองบัตรรายปี
          </h2>
          <p className="mt-1 text-sm text-slate-600 md:text-base">
            แสดงเฉพาะรายการที่ยืนยันแล้ว · กดวันที่เพื่อดูรายละเอียด
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={calendarHref({
              month: shiftMonth(selectedMonth, -1),
              tier: selectedTier,
              zone: selectedZone,
            })}
            className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-bold text-green-900 hover:bg-green-50 md:text-base"
            aria-label="ดูเดือนก่อนหน้า"
          >
            ← เดือนก่อน
          </Link>
          <Link
            href={calendarHref({
              month: currentMonth,
              date: today,
              tier: selectedTier,
              zone: selectedZone,
            })}
            className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-bold text-amber-900 hover:bg-yellow-100 md:text-base"
          >
            วันนี้
          </Link>
          <Link
            href={calendarHref({
              month: shiftMonth(selectedMonth, 1),
              tier: selectedTier,
              zone: selectedZone,
            })}
            className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-bold text-green-900 hover:bg-green-50 md:text-base"
            aria-label="ดูเดือนถัดไป"
          >
            เดือนถัดไป →
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <CalendarStat label="เดือนที่แสดง" value={monthLabel} />
        <CalendarStat label="ขายแล้ว" value={`${monthOrders.toLocaleString("th-TH")} ใบ`} />
        <CalendarStat label="ยอดรวม" value={`฿${monthRevenue.toLocaleString("th-TH")}`} accent />
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b bg-green-50 text-center text-sm font-bold text-green-900 md:text-base">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-2.5">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-slate-100/70">
            {Array.from({ length: firstWeekday }, (_, index) => (
              <div key={`blank-${index}`} className="min-h-28 border-b border-r border-slate-200 bg-slate-50" aria-hidden />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const dateKey = `${selectedMonth}-${String(day).padStart(2, "0")}`;
              const summary = ordersByDate.get(dateKey);
              const selected = selectedDate === dateKey;
              const isToday = today === dateKey;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`grid size-8 place-items-center rounded-full text-sm font-black ${isToday ? "bg-yellow-400 text-green-950" : "text-slate-700"}`}>
                      {day}
                    </span>
                    {summary && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                        {summary.orders.length.toLocaleString("th-TH")} ใบ
                      </span>
                    )}
                  </div>
                  {summary ? (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-500">ยอดขาย</p>
                      <p className="text-base font-black text-green-900">
                        ฿{summary.revenue.toLocaleString("th-TH")}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-5 text-xs text-slate-400">ไม่มีรายการ</p>
                  )}
                </>
              );

              return summary ? (
                <Link
                  key={dateKey}
                  href={calendarHref({
                    month: selectedMonth,
                    date: dateKey,
                    tier: selectedTier,
                    zone: selectedZone,
                    hash: "season-pass-calendar-details",
                  })}
                  aria-current={selected ? "date" : undefined}
                  aria-label={`${formatDateLabel(dateKey)} ขาย ${summary.orders.length} ใบ ยอด ${summary.revenue.toLocaleString("th-TH")} บาท`}
                  className={`min-h-28 border-b border-r p-2.5 transition hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-700 ${selected ? "border-green-500 bg-green-50 ring-2 ring-inset ring-green-600" : "border-slate-200 bg-white"}`}
                >
                  {content}
                </Link>
              ) : (
                <div key={dateKey} className="min-h-28 border-b border-r border-slate-200 bg-white p-2.5">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDate && (
        <div id="season-pass-calendar-details" className="mt-6 scroll-mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-green-900 md:text-2xl">
                รายละเอียดวันที่ {formatDateLabel(selectedDate)}
              </h3>
              <p className="mt-1 text-sm text-slate-600 md:text-base">
                {selectedOrders.length.toLocaleString("th-TH")} ใบ · ยอดรวม ฿{(selectedSummary?.revenue ?? 0).toLocaleString("th-TH")}
              </p>
            </div>
            <Link
              href={calendarHref({
                month: selectedMonth,
                tier: selectedTier,
                zone: selectedZone,
              })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:text-base"
            >
              ปิดรายละเอียดรายวัน
            </Link>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[980px] text-sm md:text-base">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600 md:text-sm">
                <tr>
                  <th className="px-3 py-2">เวลา</th>
                  <th className="px-3 py-2">รหัสบัตร</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">แพ็กเกจ</th>
                  <th className="px-3 py-2">โซน</th>
                  <th className="px-3 py-2">ช่องทาง</th>
                  <th className="px-3 py-2 text-right">ยอดรวม</th>
                  <th className="px-3 py-2 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">ไม่มีรายการขายในวันนี้</td>
                  </tr>
                ) : (
                  selectedOrders.map((order) => (
                    <tr key={order.id} className="border-t align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDateTime(getSaleDate(order))}</td>
                      <td className="px-3 py-2 font-mono text-xs md:text-sm">{order.passCode}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900">{order.customerName}</div>
                        <div className="text-xs text-slate-500 md:text-sm">{order.customerPhone}</div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-green-900">{getTierLabel(order.tierId)}</td>
                      <td className="px-3 py-2">{order.seatZone}</td>
                      <td className="px-3 py-2">{getSalesChannelLabel(order.salesChannel)}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-900">
                        ฿{(order.priceBaht + order.shippingFeeBaht).toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/season-passes/${order.id}/edit?tier=${encodeURIComponent(order.tierId)}`}
                          className="font-semibold text-green-700 hover:underline"
                        >
                          ดู/แก้ไข
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function CalendarStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-yellow-300 bg-yellow-50" : "border-green-100 bg-green-50/50"}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 md:text-sm">{label}</p>
      <p className={`mt-1 text-xl font-black md:text-2xl ${accent ? "text-amber-800" : "text-green-900"}`}>{value}</p>
    </div>
  );
}

function getSaleDate(order: Pick<CalendarOrder, "soldAt" | "createdAt">) {
  return order.soldAt ?? order.createdAt;
}

function toBangkokDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMonth(value?: string) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2020 && year <= 2100 ? value : null;
}

function normalizeDate(value: string | undefined, month: string) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return undefined;
  if (!value.startsWith(`${month}-`)) return undefined;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function calendarHref({
  month,
  date,
  tier,
  zone,
  hash,
}: {
  month: string;
  date?: string;
  tier: SeasonTierId;
  zone?: string;
  hash?: string;
}) {
  const query = new URLSearchParams({ month, tier });
  if (date) query.set("date", date);
  if (zone) query.set("zone", zone);
  return `/admin/season-passes?${query.toString()}${hash ? `#${hash}` : ""}`;
}

function getTierLabel(tierId: string) {
  return SEASON_TIERS.find((tier) => tier.id === tierId)?.badge ?? tierId;
}

function getSalesChannelLabel(channel: SeasonPassSalesChannel) {
  if (channel === "OFFLINE") return "ทีมงาน";
  if (channel === "INTERNAL") return "ภายในสโมสร";
  return "เว็บไซต์";
}
