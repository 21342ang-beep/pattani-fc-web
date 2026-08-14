import Link from "next/link";
import { Ticket, ArrowRight, BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyCustomer } from "@/lib/customer-dal";
import { formatBaht, formatDateTime } from "@/lib/format";
import { getSeasonTier } from "@/lib/season-pass-tiers";
import { getMemberTicketIds } from "@/lib/member-tickets";
import { expirePendingSeasonPassPurchases } from "@/lib/season-pass-expiry";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตั๋วของฉัน — Pattani FC" };

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "รอชำระเงิน", tone: "bg-yellow-100 text-yellow-900" },
  CONFIRMED: { label: "ยืนยันแล้ว", tone: "bg-emerald-100 text-emerald-900" },
  CANCELLED: { label: "ยกเลิก", tone: "bg-slate-100 text-slate-700" },
  REFUNDED: { label: "คืนเงิน", tone: "bg-rose-100 text-rose-900" },
};

function statusOf(status: string) {
  return STATUS_LABEL[status] ?? { label: status, tone: "bg-slate-100 text-slate-700" };
}

export default async function MyTicketsPage() {
  const customer = await verifyCustomer();
  await expirePendingSeasonPassPurchases();
  const ticketIds = await getMemberTicketIds(customer);

  const [bookings, seasonPasses] = await Promise.all([
    prisma.booking.findMany({
      where: {
        id: { in: ticketIds.bookingIds },
      },
      include: {
        match: {
          select: {
            homeTeam: true,
            awayTeam: true,
            venue: true,
            kickoffAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.seasonPassOrder.findMany({
      where: {
        id: { in: ticketIds.seasonPassOrderIds },
      },
      include: {
        purchase: { select: { purchaseCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const total = bookings.length + seasonPasses.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-green-900 md:text-3xl">ตั๋วของฉัน</h1>
          <p className="mt-1 text-sm text-slate-600">
            บัตรรายปีและตั๋วรายแมตช์ทั้งหมดที่ผูกกับบัญชี{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {customer.email}
            </code>
          </p>
        </div>
        <span className="rounded-full bg-green-800 px-3 py-1 text-xs font-bold text-yellow-300">
          {total} รายการ
        </span>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-xl font-black text-green-900">
          <BadgeCheck className="size-5" /> บัตรรายปี (Season Pass)
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-900">
            {seasonPasses.length}
          </span>
        </h2>
        {seasonPasses.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-slate-500">ยังไม่มีบัตรรายปี</p>
            <Link
              href="/tickets/season"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2 text-sm font-bold text-green-950 hover:bg-yellow-300"
            >
              สมัครบัตรรายปี <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {seasonPasses.map((pass) => {
              const status = statusOf(pass.status);
              const tier = getSeasonTier(pass.tierId);
              return (
                <li key={pass.id}>
                  <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-green-300 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.tone}`}>
                          {status.label}
                        </span>
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {pass.passCode}
                        </code>
                      </div>
                      <h3 className="mt-2 truncate text-lg font-bold text-green-900">
                        {tier?.name ?? pass.tierId} · ฤดูกาล {pass.seasonLabel}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        โซนที่นั่ง {pass.seatZone}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        สมัครเมื่อ {formatDateTime(pass.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">รวม</p>
                        <p className="text-lg font-black text-green-900">
                          ฿{(pass.priceBaht + pass.shippingFeeBaht).toLocaleString("th-TH")}
                        </p>
                      </div>
                      {(pass.status === "CONFIRMED" || pass.status === "PENDING") && (
                        <Link
                          href={pass.status === "PENDING"
                            ? `/checkout/season/${encodeURIComponent(pass.purchase?.purchaseCode ?? pass.passCode)}`
                            : `/tickets/season/${encodeURIComponent(pass.passCode)}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-yellow-300 transition hover:bg-green-900"
                        >
                          {pass.status === "PENDING" ? "ชำระเงิน" : "เปิดบาร์โค้ด"} <ArrowRight className="size-4" />
                        </Link>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-black text-green-900">
          <Ticket className="size-5" /> ตั๋วรายแมตช์
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-900">
            {bookings.length}
          </span>
        </h2>
        {bookings.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-slate-500">ยังไม่มีประวัติการจองตั๋วรายแมตช์</p>
            <Link
              href="/matches"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2 text-sm font-bold text-green-950 hover:bg-yellow-300"
            >
              ดูตารางแข่งขัน <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {bookings.map((b) => {
              const status = statusOf(b.status);
              return (
                <li key={b.id}>
                  <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-green-300 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.tone}`}>
                          {status.label}
                        </span>
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {b.bookingCode}
                        </code>
                      </div>
                      <h3 className="mt-2 truncate text-lg font-bold text-green-900">
                        {b.match.homeTeam} vs {b.match.awayTeam}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {b.match.venue ?? "—"} ·{" "}
                        {b.match.kickoffAt ? formatDateTime(b.match.kickoffAt) : "—"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        จอง {b.quantity} ที่นั่ง · จองเมื่อ {formatDateTime(b.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">รวม</p>
                        <p className="text-lg font-black text-green-900">
                          {formatBaht(b.totalAmount)}
                        </p>
                      </div>
                      <Link
                        href={
                          b.status === "PENDING"
                            ? `/checkout/${b.bookingCode}`
                            : `/tickets/${b.bookingCode}`
                        }
                        className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-yellow-300 transition hover:bg-green-900"
                      >
                        {b.status === "PENDING" ? "ชำระเงิน" : "ดูตั๋ว"}
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
