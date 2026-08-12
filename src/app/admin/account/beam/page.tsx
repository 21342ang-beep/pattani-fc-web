import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { BeamApiError, listAllBeamTransactions, type BeamTransaction } from "@/lib/beam";
import { verifyPermission } from "@/lib/dal";
import { formatBaht, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "ธุรกรรม Beam — Pattani FC Admin" };

const LIGHTHOUSE_URL = "https://lighthouse.beamcheckout.com/merchant/pattanifc-59ed6f/accounting/transaction-history";
const PAGE_SIZE = 50;

type SearchParams = {
  from?: string;
  to?: string;
  page?: string;
  range?: string;
};

type LinkedPayment = {
  label: string;
  code: string;
  customer: string;
  href?: string;
};

function bangkokDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function validDateInput(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function transactionDate(transaction: BeamTransaction) {
  const value = transaction.transactionTime || transaction.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOutgoing(transaction: BeamTransaction) {
  return transaction.transactionType === "REFUND" || transaction.transactionType === "VOID";
}

function signedAmount(amount: number, transaction: BeamTransaction) {
  return isOutgoing(transaction) ? -Math.abs(amount) : Math.abs(amount);
}

function transactionTypeLabel(type: string) {
  if (type === "PAYMENT") return "รับชำระ";
  if (type === "REFUND") return "คืนเงิน";
  if (type === "VOID") return "ยกเลิกยอด";
  return type || "ไม่ระบุ";
}

function queryHref(page: number, from: string, to: string, all: boolean) {
  const query = new URLSearchParams();
  if (all) query.set("range", "all");
  else {
    query.set("from", from);
    query.set("to", to);
  }
  if (page > 1) query.set("page", String(page));
  return `/admin/account/beam?${query}`;
}

export default async function BeamTransactionsPage(props: { searchParams: Promise<SearchParams> }) {
  await verifyPermission("ACCOUNT");
  const params = await props.searchParams;
  const today = bangkokDateParts(new Date());
  const defaultFrom = `${today.year}-${today.month}-01`;
  const defaultTo = `${today.year}-${today.month}-${today.day}`;
  const showAll = params.range === "all";
  const from = showAll ? "" : validDateInput(params.from) || defaultFrom;
  const to = showAll ? "" : validDateInput(params.to) || defaultTo;
  const requestedPage = /^\d+$/.test(params.page ?? "") ? Number(params.page) : 1;

  let transactions: BeamTransaction[] = [];
  let totalCount = 0;
  let truncated = false;
  let apiError = "";

  try {
    const result = await listAllBeamTransactions();
    transactions = result.transactions;
    totalCount = result.totalCount;
    truncated = result.truncated;
  } catch (error) {
    apiError = error instanceof BeamApiError ? error.message : "ไม่สามารถโหลดข้อมูลจาก Beam ได้";
  }

  const fromTime = from ? new Date(`${from}T00:00:00+07:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = to ? new Date(`${to}T23:59:59.999+07:00`).getTime() : Number.POSITIVE_INFINITY;
  const filtered = transactions
    .filter((transaction) => {
      const date = transactionDate(transaction);
      return date && date.getTime() >= fromTime && date.getTime() <= toTime;
    })
    .sort((a, b) => (transactionDate(b)?.getTime() ?? 0) - (transactionDate(a)?.getTime() ?? 0));

  const references = [...new Set(filtered.map((transaction) => transaction.referenceId))];
  const paymentLinks = references.length > 0
    ? await prisma.beamPayment.findMany({
        where: { referenceId: { in: references } },
        select: {
          referenceId: true,
          booking: {
            select: {
              bookingCode: true,
              customerName: true,
              match: { select: { homeTeam: true, awayTeam: true } },
            },
          },
          seasonPassOrder: {
            select: { passCode: true, customerName: true, seatZone: true },
          },
          seasonPassPurchase: {
            select: {
              purchaseCode: true,
              customerEmail: true,
              quantity: true,
              orders: { take: 1, select: { passCode: true, customerName: true } },
            },
          },
        },
      })
    : [];
  const linkedByReference = new Map<string, LinkedPayment>();
  for (const payment of paymentLinks) {
    if (payment.booking) {
      linkedByReference.set(payment.referenceId, {
        label: `${payment.booking.match.homeTeam} vs ${payment.booking.match.awayTeam}`,
        code: payment.booking.bookingCode,
        customer: payment.booking.customerName,
        href: `/tickets/${payment.booking.bookingCode}`,
      });
    } else if (payment.seasonPassOrder) {
      linkedByReference.set(payment.referenceId, {
        label: `บัตรรายปี · โซน ${payment.seasonPassOrder.seatZone}`,
        code: payment.seasonPassOrder.passCode,
        customer: payment.seasonPassOrder.customerName,
        href: `/tickets/season/${payment.seasonPassOrder.passCode}`,
      });
    } else if (payment.seasonPassPurchase) {
      const firstOrder = payment.seasonPassPurchase.orders[0];
      linkedByReference.set(payment.referenceId, {
        label: `บัตรรายปี ${payment.seasonPassPurchase.quantity} ใบ`,
        code: payment.seasonPassPurchase.purchaseCode,
        customer: firstOrder?.customerName || payment.seasonPassPurchase.customerEmail || "—",
        href: firstOrder ? `/tickets/season/${firstOrder.passCode}` : undefined,
      });
    }
  }

  const paymentGross = filtered
    .filter((transaction) => transaction.transactionType === "PAYMENT")
    .reduce((sum, transaction) => sum + Math.abs(transaction.grossAmount), 0);
  const refunds = filtered
    .filter(isOutgoing)
    .reduce((sum, transaction) => sum + Math.abs(transaction.grossAmount), 0);
  const feesAndVat = filtered
    .filter((transaction) => transaction.transactionType === "PAYMENT")
    .reduce((sum, transaction) => sum + Math.abs(transaction.feeAmount) + Math.abs(transaction.vatAmount), 0);
  const netMovement = filtered.reduce(
    (sum, transaction) => sum + signedAmount(transaction.netAmount, transaction),
    0,
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const visibleTransactions = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/account" className="inline-flex items-center gap-1 text-sm font-semibold text-green-800 hover:underline">
            <ArrowLeft className="size-4" /> กลับหน้าบัญชี
          </Link>
          <p className="mt-5 text-sm font-bold uppercase tracking-widest text-violet-600">Beam Accounting</p>
          <h1 className="mt-1 text-3xl font-black text-green-900">ธุรกรรม Beam</h1>
          <p className="mt-2 text-slate-600">ยอดเงินจริงจาก Beam พร้อมเชื่อมโยงกับรายการจองในระบบ Pattani FC</p>
        </div>
        <a
          href={LIGHTHOUSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-3 font-bold text-violet-700 shadow-sm hover:bg-violet-50"
        >
          เปิด Beam Lighthouse <ArrowUpRight className="size-4" />
        </a>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label>
          <span className="block text-sm font-semibold text-slate-700">ตั้งแต่วันที่</span>
          <input name="from" type="date" defaultValue={from} className="mt-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        </label>
        <label>
          <span className="block text-sm font-semibold text-slate-700">ถึงวันที่</span>
          <input name="to" type="date" defaultValue={to} className="mt-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        </label>
        <button type="submit" className="rounded-lg bg-violet-700 px-5 py-2.5 font-bold text-white hover:bg-violet-800">แสดงข้อมูล</button>
        <Link href="/admin/account/beam?range=all" className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">ดูทั้งหมด</Link>
        <Link href="/admin/account/beam" className="inline-flex items-center gap-1 rounded-lg px-3 py-2.5 font-semibold text-slate-500 hover:bg-slate-50"><RotateCcw className="size-4" /> เดือนนี้</Link>
      </form>

      {apiError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="font-bold">ยังแสดงข้อมูล Beam ไม่ได้</p>
          <p className="mt-1 text-sm">{apiError} กรุณาตรวจสอบ `BEAM_MERCHANT_ID` และ `BEAM_API_KEY` ของเซิร์ฟเวอร์ หรือลองใหม่อีกครั้ง</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<CircleDollarSign className="size-5" />} label="ยอดรับ" value={formatBaht(paymentGross)} detail={`${filtered.filter((item) => item.transactionType === "PAYMENT").length} รายการ`} tone="emerald" />
            <SummaryCard icon={<RotateCcw className="size-5" />} label="คืนเงิน/ยกเลิกยอด" value={formatBaht(refunds)} detail={`${filtered.filter(isOutgoing).length} รายการ`} tone="rose" />
            <SummaryCard icon={<ReceiptText className="size-5" />} label="ค่าธรรมเนียม + VAT" value={formatBaht(feesAndVat)} detail="หักจากรายการรับชำระ" tone="amber" />
            <SummaryCard icon={<WalletCards className="size-5" />} label="ยอดสุทธิ" value={formatBaht(netMovement)} detail={`จาก ${filtered.length.toLocaleString("th-TH")} ธุรกรรม`} tone="violet" />
          </section>

          {truncated && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Beam มีทั้งหมด {totalCount.toLocaleString("th-TH")} รายการ หน้านี้แสดงข้อมูลล่าสุดไม่เกิน 2,000 รายการ กรุณาใช้ Lighthouse เมื่อต้องตรวจประวัติเก่ากว่านี้
            </p>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-green-900">รายละเอียดเงินเข้าและรายการปรับยอด</h2>
                <p className="text-sm text-slate-500">พบ {filtered.length.toLocaleString("th-TH")} รายการในช่วงที่เลือก</p>
              </div>
              <Banknote className="size-7 text-violet-600" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">วันเวลา</th>
                    <th className="px-4 py-3">ประเภท</th>
                    <th className="px-4 py-3">รายการในระบบ</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-right">ยอดเต็ม</th>
                    <th className="px-4 py-3 text-right">ค่าธรรมเนียม</th>
                    <th className="px-4 py-3 text-right">VAT</th>
                    <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((transaction) => {
                    const linked = linkedByReference.get(transaction.referenceId);
                    const outgoing = isOutgoing(transaction);
                    const date = transactionDate(transaction);
                    return (
                      <tr key={transaction.transactionId} className="border-t border-slate-100 align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{date ? formatDateTime(date) : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${outgoing ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {transactionTypeLabel(transaction.transactionType)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {linked ? (
                            <div>
                              {linked.href ? <Link href={linked.href} className="font-bold text-green-800 hover:underline">{linked.label}</Link> : <p className="font-bold text-green-900">{linked.label}</p>}
                              <p className="mt-0.5 text-slate-600">{linked.customer}</p>
                              <p className="font-mono text-xs text-slate-400">{linked.code}</p>
                            </div>
                          ) : <span className="text-slate-400">ไม่พบรายการที่เชื่อมโยง</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-64 break-all font-mono text-xs text-slate-600">{transaction.referenceId}</p>
                          <p className="mt-1 font-mono text-[11px] text-slate-400">{transaction.transactionId}</p>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-bold ${outgoing ? "text-rose-700" : "text-emerald-700"}`}>{formatBaht(signedAmount(transaction.grossAmount, transaction))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatBaht(Math.abs(transaction.feeAmount))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatBaht(Math.abs(transaction.vatAmount))}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-black ${outgoing ? "text-rose-800" : "text-violet-800"}`}>{formatBaht(signedAmount(transaction.netAmount, transaction))}</td>
                      </tr>
                    );
                  })}
                  {visibleTransactions.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">ไม่พบธุรกรรม Beam ในช่วงวันที่เลือก</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {pageCount > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="หน้ารายการธุรกรรม Beam">
              {page > 1 ? <Link href={queryHref(page - 1, from, to, showAll)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">ก่อนหน้า</Link> : null}
              <span className="text-sm text-slate-600">หน้า {page.toLocaleString("th-TH")} / {pageCount.toLocaleString("th-TH")}</span>
              {page < pageCount ? <Link href={queryHref(page + 1, from, to, showAll)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">ถัดไป</Link> : null}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "rose" | "amber" | "violet";
}) {
  const styles = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
    rose: "border-rose-100 bg-rose-50 text-rose-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  }[tone];
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}>
      <div className="flex items-center gap-2 text-sm font-bold">{icon}{label}</div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm opacity-75">{detail}</p>
    </div>
  );
}
