import { ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertCircle } from "lucide-react";
import { verifyAdmin } from "@/lib/dal";
import { payload } from "@/lib/payload";
import { formatBaht, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "การเงิน — Pattani FC Admin" };

type RevenueDoc = {
  id: string | number;
  recordedAt: string;
  title: string;
  source: string;
  amountSatang: number;
  notes?: string;
};
type ExpenseDoc = {
  id: string | number;
  recordedAt: string;
  title: string;
  expenseType: string;
  vendor?: string;
  amountSatang: number;
  paymentStatus: "paid" | "unpaid" | "void";
};

const REVENUE_SOURCE_LABEL: Record<string, string> = {
  "ticket-sales": "ขายตั๋ว",
  sponsorship: "สปอนเซอร์",
  merchandise: "ขายสินค้า",
  "prize-money": "เงินรางวัล",
  other: "อื่นๆ",
};

const EXPENSE_TYPE_LABEL: Record<string, string> = {
  salaries: "เงินเดือน",
  travel: "ค่าเดินทาง",
  facilities: "ค่าสนาม/อุปกรณ์",
  marketing: "การตลาด",
  "fees-tax": "ค่าธรรมเนียม/ภาษี",
  operations: "ดำเนินงาน",
  other: "อื่นๆ",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: "จ่ายแล้ว",
  unpaid: "รอจ่าย",
  void: "ยกเลิก",
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

export default async function FinancePage() {
  await verifyAdmin();
  const cms = await payload();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const yearStart = startOfYear(now).toISOString();

  const [
    revYear,
    expYear,
    unpaidExp,
    recentRev,
    recentExp,
  ] = await Promise.all([
    cms.find({
      collection: "revenues",
      where: { recordedAt: { greater_than_equal: yearStart } },
      limit: 5000,
      overrideAccess: true,
    }),
    cms.find({
      collection: "expenses",
      where: { recordedAt: { greater_than_equal: yearStart } },
      limit: 5000,
      overrideAccess: true,
    }),
    cms.find({
      collection: "expenses",
      where: { paymentStatus: { equals: "unpaid" } },
      limit: 1000,
      overrideAccess: true,
    }),
    cms.find({
      collection: "revenues",
      sort: "-recordedAt",
      limit: 10,
      overrideAccess: true,
    }),
    cms.find({
      collection: "expenses",
      sort: "-recordedAt",
      limit: 10,
      overrideAccess: true,
    }),
  ]);

  const revenuesYear = revYear.docs as unknown as RevenueDoc[];
  const expensesYear = expYear.docs as unknown as ExpenseDoc[];
  const unpaidExpenses = unpaidExp.docs as unknown as ExpenseDoc[];

  const isThisMonth = (iso: string) =>
    new Date(iso).getTime() >= startOfMonth(now).getTime();

  const totalRevMonth = revenuesYear
    .filter((r) => isThisMonth(r.recordedAt))
    .reduce((s, r) => s + (r.amountSatang ?? 0), 0);
  const totalRevYear = revenuesYear.reduce(
    (s, r) => s + (r.amountSatang ?? 0),
    0
  );
  const totalExpMonth = expensesYear
    .filter(
      (e) => isThisMonth(e.recordedAt) && e.paymentStatus !== "void"
    )
    .reduce((s, e) => s + (e.amountSatang ?? 0), 0);
  const totalExpYear = expensesYear
    .filter((e) => e.paymentStatus !== "void")
    .reduce((s, e) => s + (e.amountSatang ?? 0), 0);
  const totalUnpaid = unpaidExpenses.reduce(
    (s, e) => s + (e.amountSatang ?? 0),
    0
  );

  const revBySource: Record<string, number> = {};
  for (const r of revenuesYear) {
    revBySource[r.source] = (revBySource[r.source] ?? 0) + (r.amountSatang ?? 0);
  }
  const expByType: Record<string, number> = {};
  for (const e of expensesYear) {
    if (e.paymentStatus === "void") continue;
    expByType[e.expenseType] =
      (expByType[e.expenseType] ?? 0) + (e.amountSatang ?? 0);
  }

  type TxRow = {
    kind: "revenue" | "expense";
    id: string;
    date: string;
    title: string;
    category: string;
    amount: number;
    status?: string;
  };
  const recent: TxRow[] = [
    ...(recentRev.docs as unknown as RevenueDoc[]).map((r): TxRow => ({
      kind: "revenue",
      id: String(r.id),
      date: r.recordedAt,
      title: r.title,
      category: REVENUE_SOURCE_LABEL[r.source] ?? r.source,
      amount: r.amountSatang,
    })),
    ...(recentExp.docs as unknown as ExpenseDoc[]).map((e): TxRow => ({
      kind: "expense",
      id: String(e.id),
      date: e.recordedAt,
      title: e.title,
      category: EXPENSE_TYPE_LABEL[e.expenseType] ?? e.expenseType,
      amount: e.amountSatang,
      status: e.paymentStatus,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-green-900">การเงิน</h1>
        <p className="text-sm text-muted-foreground">
          ภาพรวมรายรับ-ค่าใช้จ่ายของสโมสร (ข้อมูลจาก Payload CMS)
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ArrowUpCircle className="size-5 text-emerald-600" />}
          label="รายรับเดือนนี้"
          value={formatBaht(totalRevMonth)}
          sub={`รวมปีนี้: ${formatBaht(totalRevYear)}`}
          tint="emerald"
        />
        <StatCard
          icon={<ArrowDownCircle className="size-5 text-red-600" />}
          label="ค่าใช้จ่ายเดือนนี้"
          value={formatBaht(totalExpMonth)}
          sub={`รวมปีนี้: ${formatBaht(totalExpYear)}`}
          tint="red"
        />
        <StatCard
          icon={<TrendingUp className="size-5 text-green-700" />}
          label="กำไรสุทธิเดือนนี้"
          value={formatBaht(totalRevMonth - totalExpMonth)}
          sub={`สุทธิปีนี้: ${formatBaht(totalRevYear - totalExpYear)}`}
          tint="green"
          highlight
        />
        <StatCard
          icon={<AlertCircle className="size-5 text-amber-600" />}
          label="ค่าใช้จ่ายรอจ่าย"
          value={formatBaht(totalUnpaid)}
          sub={`${unpaidExpenses.length} รายการ`}
          tint="amber"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-green-900">
              รายรับแยกตามแหล่งที่มา (ปีนี้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              items={Object.entries(revBySource)
                .map(([key, val]) => ({
                  label: REVENUE_SOURCE_LABEL[key] ?? key,
                  amount: val,
                }))
                .sort((a, b) => b.amount - a.amount)}
              total={totalRevYear}
              accent="emerald"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-green-900">
              ค่าใช้จ่ายแยกตามประเภท (ปีนี้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              items={Object.entries(expByType)
                .map(([key, val]) => ({
                  label: EXPENSE_TYPE_LABEL[key] ?? key,
                  amount: val,
                }))
                .sort((a, b) => b.amount - a.amount)}
              total={totalExpYear}
              accent="red"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-green-900">
            รายการล่าสุด (20 รายการ)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการบัญชี เริ่มบันทึกใน Payload CMS ที่ /cms
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50 text-left text-xs uppercase text-green-900">
                  <tr>
                    <th className="px-4 py-2">วันที่</th>
                    <th className="px-4 py-2">รายการ</th>
                    <th className="px-4 py-2">หมวด</th>
                    <th className="px-4 py-2">สถานะ</th>
                    <th className="px-4 py-2 text-right">จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={`${t.kind}-${t.id}`} className="border-t">
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {formatDateTime(t.date)}
                      </td>
                      <td className="px-4 py-2 font-medium text-green-900">
                        {t.title}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {t.category}
                      </td>
                      <td className="px-4 py-2">
                        {t.kind === "revenue" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            รายรับ
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={
                              t.status === "paid"
                                ? "bg-slate-100 text-slate-700"
                                : t.status === "void"
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-amber-100 text-amber-800"
                            }
                          >
                            {PAYMENT_STATUS_LABEL[t.status ?? "unpaid"]}
                          </Badge>
                        )}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-semibold ${
                          t.kind === "revenue"
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {t.kind === "revenue" ? "+" : "−"}
                        {formatBaht(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint: "emerald" | "red" | "green" | "amber";
  highlight?: boolean;
}) {
  const borderClass = highlight
    ? "border-yellow-400 bg-yellow-50"
    : tint === "emerald"
      ? "border-emerald-100"
      : tint === "red"
        ? "border-red-100"
        : tint === "amber"
          ? "border-amber-100"
          : "border-green-100";
  return (
    <Card className={borderClass}>
      <CardContent className="py-5">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className="mt-1 text-xl font-bold text-green-900">{value}</p>
        {sub && (
          <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownList({
  items,
  total,
  accent,
}: {
  items: { label: string; amount: number }[];
  total: number;
  accent: "emerald" | "red";
}) {
  if (items.length === 0 || total === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        ยังไม่มีรายการ
      </p>
    );
  }
  const barColor = accent === "emerald" ? "bg-emerald-500" : "bg-red-500";
  return (
    <ul className="space-y-3">
      {items.map((it) => {
        const pct = total > 0 ? Math.round((it.amount / total) * 100) : 0;
        return (
          <li key={it.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-green-900">{it.label}</span>
              <span className="text-xs text-muted-foreground">
                {formatBaht(it.amount)} · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
