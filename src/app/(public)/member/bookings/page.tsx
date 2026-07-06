import Link from "next/link";
import { Ticket, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyCustomer } from "@/lib/customer-dal";
import { formatBaht, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "การจองของฉัน — Pattani FC" };

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "รอชำระเงิน", tone: "bg-yellow-100 text-yellow-900" },
  CONFIRMED: { label: "ยืนยันแล้ว", tone: "bg-emerald-100 text-emerald-900" },
  CANCELLED: { label: "ยกเลิก", tone: "bg-slate-100 text-slate-700" },
  REFUNDED: { label: "คืนเงิน", tone: "bg-rose-100 text-rose-900" },
};

export default async function MyBookingsPage() {
  const customer = await verifyCustomer();

  const bookings = await prisma.booking.findMany({
    where: {
      customerEmail: { equals: customer.email, mode: "insensitive" },
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
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-green-900 md:text-3xl">
            การจองของฉัน
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            ประวัติการจองทั้งหมดที่ผูกกับอีเมล{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {customer.email}
            </code>
          </p>
        </div>
        <span className="rounded-full bg-green-800 px-3 py-1 text-xs font-bold text-yellow-300">
          {bookings.length} รายการ
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Ticket className="mx-auto size-10 text-slate-300" />
          <p className="mt-3 text-lg text-slate-500">ยังไม่มีประวัติการจอง</p>
          <p className="mt-1 text-sm text-slate-400">
            เริ่มจองตั๋วเข้าชมแมตช์ของ Pattani FC ได้เลย
          </p>
          <Link
            href="/matches"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-green-950 hover:bg-yellow-300"
          >
            ดูตารางแข่งขัน <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((b) => {
            const status = STATUS_LABEL[b.status] ?? {
              label: b.status,
              tone: "bg-slate-100 text-slate-700",
            };
            return (
              <li key={b.id}>
                <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-green-300 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.tone}`}
                      >
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
                      จอง {b.quantity} ที่นั่ง · จองเมื่อ{" "}
                      {formatDateTime(b.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        รวม
                      </p>
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
    </div>
  );
}
