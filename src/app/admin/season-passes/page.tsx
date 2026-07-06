import {
  SEASON_LABEL,
  SEASON_MATCHES,
  SEASON_TIERS,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "บัตรรายปี — Admin" };

// ⚠️ mock placeholder — ยังไม่มี model SeasonPassOrder ใน DB
// เมื่อมี server จริงและเพิ่ม model แล้ว → ดึงจาก prisma.seasonPassOrder.findMany() แทน
const MOCK_ORDERS: {
  passCode: string;
  tierId: SeasonTierId;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: Date;
}[] = [
  {
    passCode: "SP-VE-XK3M9P2A",
    tierId: "vvip-elite",
    customerName: "สมชาย ใจดี",
    customerPhone: "081-234-5678",
    customerEmail: "somchai@example.com",
    status: "CONFIRMED",
    createdAt: new Date("2026-07-01T10:15:00"),
  },
  {
    passCode: "SP-VA-N7WQ4RJ2",
    tierId: "vip-advanced",
    customerName: "อารีย์ ปันสุข",
    customerPhone: "089-111-2233",
    customerEmail: null,
    status: "CONFIRMED",
    createdAt: new Date("2026-07-02T14:32:00"),
  },
  {
    passCode: "SP-P-KL9BXFT3",
    tierId: "premium",
    customerName: "มะห์มูด มะสาลอ",
    customerPhone: "062-555-8888",
    customerEmail: "mahmud@example.com",
    status: "PENDING",
    createdAt: new Date("2026-07-03T09:00:00"),
  },
  {
    passCode: "SP-G-J2H6ND5Q",
    tierId: "gold",
    customerName: "วิภา รัตนภัณฑ์",
    customerPhone: "086-999-1234",
    customerEmail: null,
    status: "CANCELLED",
    createdAt: new Date("2026-07-04T18:45:00"),
  },
];

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  REFUNDED: "bg-blue-100 text-blue-800",
};

export default function AdminSeasonPassesPage() {
  const tierById = new Map(SEASON_TIERS.map((t) => [t.id, t]));

  const summary = {
    total: MOCK_ORDERS.length,
    confirmed: MOCK_ORDERS.filter((o) => o.status === "CONFIRMED").length,
    pending: MOCK_ORDERS.filter((o) => o.status === "PENDING").length,
    revenue: MOCK_ORDERS.filter((o) => o.status === "CONFIRMED").reduce(
      (sum, o) => sum + (tierById.get(o.tierId)?.priceBaht ?? 0),
      0
    ),
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-900">
            บัตรรายปี · Season Pass {SEASON_LABEL}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            บัตรสมาชิกครอบคลุม {SEASON_MATCHES} แมตช์เหย้าต่อฤดูกาล
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">
          ⚠️ โหมดตัวอย่าง — ยังไม่ได้เชื่อมกับฐานข้อมูล
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          หน้านี้แสดง <strong>ข้อมูลจำลอง</strong> เพื่อดู UI ที่จะใช้ในโปรดักชัน —
          ระบบซื้อบัตรรายปี ({" "}
          <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-[11px]">
            /season-pass/apply
          </code>{" "}
          ) ยังไม่บันทึกข้อมูลลง DB
          จะเปิดใช้งานจริงเมื่อเพิ่ม model <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-[11px]">SeasonPassOrder</code> และ deploy บน server จริง
        </p>
      </div>

      {/* สรุปตัวเลข */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="บัตรทั้งหมด" value={summary.total.toLocaleString("th-TH")} />
        <StatCard label="ยืนยันแล้ว" value={summary.confirmed.toLocaleString("th-TH")} accent="emerald" />
        <StatCard label="รอชำระ" value={summary.pending.toLocaleString("th-TH")} accent="amber" />
        <StatCard
          label="รายได้ (ยืนยันแล้ว)"
          value={`฿${summary.revenue.toLocaleString("th-TH")}`}
          accent="green"
        />
      </div>

      {/* ตารางบัตร */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">รหัสบัตร</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">ลูกค้า</th>
              <th className="px-3 py-2 text-left">ประเภท</th>
              <th className="px-3 py-2 text-right">ราคา</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="px-3 py-2 text-left">วันที่</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ORDERS.map((o) => {
              const tier = tierById.get(o.tierId);
              const isMember = !!o.customerEmail;
              return (
                <tr key={o.passCode} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{o.passCode}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-yellow-100 px-2 py-0.5 text-[11px] font-bold text-yellow-900">
                      {tier?.badge ?? o.tierId}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-slate-500">
                      {o.customerEmail ?? <span className="italic">ไม่มีอีเมล</span>}
                    </div>
                    <div className="text-xs text-slate-500">{o.customerPhone}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                        isMember
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {isMember ? "สมาชิก" : "ลูกค้าทั่วไป"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    ฿{(tier?.priceBaht ?? 0).toLocaleString("th-TH")}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${statusColor[o.status]}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {formatDateTime(o.createdAt)}
                  </td>
                </tr>
              );
            })}
            {MOCK_ORDERS.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* สรุปประเภทบัตรที่เปิดขาย */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-green-900">ประเภทบัตรที่เปิดขาย</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEASON_TIERS.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-600">
                {t.badge}
              </p>
              <p className="mt-1 text-sm font-semibold text-green-900">{t.name}</p>
              <p className="mt-2 text-2xl font-black text-green-900">
                ฿{t.priceBaht.toLocaleString("th-TH")}
              </p>
              <p className="text-xs text-slate-500">/ ฤดูกาล · {SEASON_MATCHES} แมตช์</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber" | "green";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "green"
          ? "text-green-800"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-black ${accentClass}`}>{value}</p>
    </div>
  );
}
