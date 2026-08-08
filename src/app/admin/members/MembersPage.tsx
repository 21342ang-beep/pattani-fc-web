import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getThaiProvinceCoordinate } from "@/lib/thai-province-coordinates";
import {
  SEASON_LABEL,
  SEASON_TIERS,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import DeleteMemberButton from "./DeleteMemberButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "ข้อมูลผู้ใช้งาน — Pattani FC Admin" };

type TierFilter = "all" | "none" | SeasonTierId;

export type ProvinceStat = {
  province: string;
  count: number;
  percentage: number;
};

const statusStyle: Record<string, { label: string; className: string }> = {
  CONFIRMED: {
    label: "ชำระแล้ว",
    className: "bg-emerald-100 text-emerald-800",
  },
  PENDING: {
    label: "รอชำระ",
    className: "bg-amber-100 text-amber-800",
  },
};

function membersHref(tier: TierFilter, q: string) {
  const params = new URLSearchParams();
  if (tier !== "all") params.set("tier", tier);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/admin/members?${query}` : "/admin/members";
}

function membersExportHref(tier: TierFilter, q: string) {
  const params = new URLSearchParams();
  if (tier !== "all") params.set("tier", tier);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/admin/members/export?${query}` : "/admin/members/export";
}

function formatMemberAddress(member: {
  address: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
}) {
  const locality = [member.district, member.province].filter(Boolean).join(" ");
  return [member.address, locality, member.postalCode].filter(Boolean);
}

export default async function MembersPage(props: {
  searchParams: Promise<{ q?: string; tier?: string }>;
}) {
  await verifyPermission("MEMBER_DATA");
  const { q: rawQuery, tier: rawTier } = await props.searchParams;
  const q = (rawQuery ?? "").trim().slice(0, 100);
  const selectedTier: TierFilter = [
    "all",
    "none",
    ...SEASON_TIERS.map((tier) => tier.id),
  ].includes(rawTier ?? "")
    ? (rawTier as TierFilter)
    : "all";

  const [seasonOrders, totalMembers] = await Promise.all([
    prisma.seasonPassOrder.findMany({
      where: {
        seasonLabel: SEASON_LABEL,
        customerId: { not: null },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: {
        id: true,
        passCode: true,
        tierId: true,
        seatZone: true,
        status: true,
        customerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.count(),
  ]);

  const activeMemberIds = new Set(
    seasonOrders.flatMap((order) => order.customerId ? [order.customerId] : []),
  );
  const ordersByMember = new Map<string, typeof seasonOrders>();
  for (const order of seasonOrders) {
    if (!order.customerId) continue;
    const orders = ordersByMember.get(order.customerId) ?? [];
    orders.push(order);
    ordersByMember.set(order.customerId, orders);
  }

  const memberWhere: Prisma.CustomerWhereInput = {};
  if (q) {
    memberWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  if (selectedTier === "none") {
    if (activeMemberIds.size > 0) memberWhere.id = { notIn: [...activeMemberIds] };
  } else if (selectedTier !== "all") {
    memberWhere.id = {
      in: seasonOrders.flatMap((order) =>
        order.tierId === selectedTier && order.customerId ? [order.customerId] : [],
      ),
    };
  }

  const [members, filteredMemberCount, membersWithoutPass] = await Promise.all([
    prisma.customer.findMany({
      where: memberWhere,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        district: true,
        province: true,
        postalCode: true,
        createdAt: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        accounts: { select: { provider: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customer.count({ where: memberWhere }),
    activeMemberIds.size > 0
      ? prisma.customer.count({ where: { id: { notIn: [...activeMemberIds] } } })
      : prisma.customer.count(),
  ]);

  const tierById = new Map(SEASON_TIERS.map((tier) => [tier.id, tier]));
  const tierStats = new Map(
    SEASON_TIERS.map((tier) => {
      const tierOrders = seasonOrders.filter((order) => order.tierId === tier.id);
      return [
        tier.id,
        {
          confirmed: new Set(
            tierOrders.flatMap((order) =>
              order.status === "CONFIRMED" && order.customerId ? [order.customerId] : [],
            ),
          ).size,
          pending: new Set(
            tierOrders.flatMap((order) =>
              order.status === "PENDING" && order.customerId ? [order.customerId] : [],
            ),
          ).size,
        },
      ];
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-900 md:text-4xl">ข้อมูลสมาชิก</h1>
          <p className="mt-1 text-base text-slate-600 md:text-lg">
            จำแนกสมาชิกตามแพ็กเกจบัตรรายปี ฤดูกาล {SEASON_LABEL}
          </p>
        </div>
        <Link
          href="/admin/members/provinces"
          className="rounded-lg bg-green-800 px-5 py-2.5 text-base font-semibold text-yellow-300 shadow-sm hover:bg-green-900"
        >
          แดชบอร์ดสมาชิกแยกจังหวัด
        </Link>
      </div>

      <section aria-label="สรุปสมาชิกตามแพ็กเกจ">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <PackageCard
            href={membersHref("all", q)}
            active={selectedTier === "all"}
            label="สมาชิกทั้งหมด"
            value={totalMembers}
            detail="ทุกบัญชีที่สมัครสมาชิก"
          />
          <PackageCard
            href={membersHref("none", q)}
            active={selectedTier === "none"}
            label="ยังไม่มีบัตรรายปี"
            value={membersWithoutPass}
            detail="ไม่มีรายการที่ชำระแล้วหรือรอชำระ"
          />
          {SEASON_TIERS.map((tier) => {
            const stats = tierStats.get(tier.id) ?? { confirmed: 0, pending: 0 };
            return (
              <PackageCard
                key={tier.id}
                href={membersHref(tier.id, q)}
                active={selectedTier === tier.id}
                label={`${tier.badge} · ฿${tier.priceBaht.toLocaleString("th-TH")}`}
                value={stats.confirmed}
                detail={`ชำระแล้ว · รอชำระ ${stats.pending.toLocaleString("th-TH")} คน`}
              />
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-1 flex-wrap items-center gap-2">
          {selectedTier !== "all" && <input type="hidden" name="tier" value={selectedTier} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ค้นหาชื่อ / อีเมล / เบอร์โทร"
            className="min-w-64 flex-1 rounded-lg border border-green-200 px-4 py-2.5 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          />
          <button className="rounded-lg bg-green-800 px-5 py-2.5 text-base font-semibold text-yellow-300 hover:bg-green-900">
            ค้นหา
          </button>
          {q && (
            <Link
              href={membersHref(selectedTier, "")}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-base font-semibold text-slate-600 hover:bg-slate-50"
            >
              ล้างคำค้น
            </Link>
          )}
        </form>
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-slate-500">
            พบ {filteredMemberCount.toLocaleString("th-TH")} คน
          </p>
          <Link
            href={membersExportHref(selectedTier, q)}
            className="rounded-lg bg-green-800 px-5 py-2.5 text-base font-semibold text-yellow-300 shadow-sm hover:bg-green-900"
          >
            📥 ดาวน์โหลดข้อมูลสมาชิก
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1420px] text-base">
          <thead className="bg-green-50 text-left text-sm uppercase text-green-900">
            <tr>
              <th className="px-4 py-3">ผู้ใช้งาน</th>
              <th className="px-4 py-3">ติดต่อ</th>
              <th className="px-4 py-3">ที่อยู่</th>
              <th className="px-4 py-3">แพ็กเกจบัตรรายปี</th>
              <th className="px-4 py-3">สมัครผ่าน</th>
              <th className="px-4 py-3">วันที่สมัคร</th>
              <th className="px-4 py-3">เข้าใช้ล่าสุด</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : members.map((member) => {
              const memberOrders = ordersByMember.get(member.id) ?? [];
              const addressLines = formatMemberAddress(member);
              return (
                <tr key={member.id} className="border-t align-top">
                  <td className="px-4 py-3 font-medium text-green-900">
                    <div>{member.name}</div>
                    <div className="mt-1 text-sm font-normal text-slate-500">
                      {member.emailVerifiedAt ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <div>{member.email}</div>
                    <div className="mt-1">{member.phone ?? "—"}</div>
                    {member.phone ? (
                      <div className={`mt-1 text-xs font-medium ${member.phoneVerifiedAt ? "text-emerald-700" : "text-amber-700"}`}>
                        {member.phoneVerifiedAt ? "ยืนยันเบอร์แล้ว" : "ยังไม่ยืนยันเบอร์"}
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-72 px-4 py-3 text-sm leading-relaxed text-slate-600">
                    {addressLines.length > 0
                      ? addressLines.map((line) => <div key={line}>{line}</div>)
                      : <span className="text-slate-400">ยังไม่ระบุที่อยู่</span>}
                  </td>
                  <td className="px-4 py-3">
                    {memberOrders.length === 0 ? (
                      <span className="text-sm text-slate-400">ยังไม่มีบัตรรายปี</span>
                    ) : (
                      <div className="space-y-2">
                        {memberOrders.map((order) => {
                          const tier = tierById.get(order.tierId as SeasonTierId);
                          const status = statusStyle[order.status] ?? {
                            label: order.status,
                            className: "bg-slate-100 text-slate-700",
                          };
                          return (
                            <div key={order.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-green-900">
                                  {tier?.badge ?? order.tierId}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status.className}`}>
                                  {status.label}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                โซน {order.seatZone} · <span className="font-mono">{order.passCode}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {member.accounts.length
                      ? member.accounts.map((account) => account.provider).join(", ")
                      : "อีเมล / รหัสผ่าน"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(member.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "ยังไม่เคยเข้าใช้"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteMemberButton memberId={member.id} memberName={member.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        แสดงสูงสุด 100 บัญชีล่าสุดจากทั้งหมด {filteredMemberCount.toLocaleString("th-TH")} บัญชีตามตัวกรอง
      </p>
    </div>
  );
}

export function ProvinceDashboard({
  stats,
  totalMembers,
}: {
  stats: ProvinceStat[];
  totalMembers: number;
}) {
  const specifiedStats = stats.filter((stat) => stat.province !== "ไม่ระบุจังหวัด");
  const topProvince = specifiedStats[0];
  const unspecified = stats.find((stat) => stat.province === "ไม่ระบุจังหวัด");
  const percentageFormatter = new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const formatPercentage = (value: number) => `${percentageFormatter.format(value)}%`;

  return (
    <section
      aria-labelledby="province-dashboard-title"
      className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6"
    >
      <div>
        <h2 id="province-dashboard-title" className="text-xl font-black text-green-950 md:text-2xl">
          สมาชิกแยกตามจังหวัด
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          สัดส่วนจากสมาชิกทั้งหมด {totalMembers.toLocaleString("th-TH")} คน
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ProvinceSummaryCard
          label="จังหวัดที่มีสมาชิก"
          value={`${specifiedStats.length.toLocaleString("th-TH")} จังหวัด`}
          detail="ไม่นับสมาชิกที่ยังไม่ระบุจังหวัด"
        />
        <ProvinceSummaryCard
          label="จังหวัดที่มีสมาชิกสูงสุด"
          value={topProvince?.province ?? "—"}
          detail={topProvince
            ? `${topProvince.count.toLocaleString("th-TH")} คน · ${formatPercentage(topProvince.percentage)}`
            : "ยังไม่มีข้อมูลจังหวัด"}
        />
        <ProvinceSummaryCard
          label="ไม่ระบุจังหวัด"
          value={`${(unspecified?.count ?? 0).toLocaleString("th-TH")} คน`}
          detail={formatPercentage(unspecified?.percentage ?? 0)}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(30rem,1.2fr)]">
        <ThailandMemberMap stats={specifiedStats} />

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-green-950 md:text-xl">
                กราฟจำนวนสมาชิกและเปอร์เซ็นต์
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                เรียงจากจังหวัดที่มีสมาชิกมากที่สุด
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-green-800 shadow-sm">
              รวม {totalMembers.toLocaleString("th-TH")} คน
            </span>
          </div>

          {stats.length === 0 ? (
            <p className="mt-5 rounded-xl bg-white p-6 text-center text-slate-500">
              ยังไม่มีข้อมูลสมาชิก
            </p>
          ) : (
            <div className="mt-5 grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
              {stats.map((stat) => (
                <div
                  key={stat.province}
                  data-province-percentage={stat.percentage.toFixed(1)}
                  className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-800">{stat.province}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {stat.count.toLocaleString("th-TH")} คน
                      </p>
                    </div>
                    <p className="shrink-0 text-xl font-black text-green-800">
                      {formatPercentage(stat.percentage)}
                    </p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-green-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-700 to-emerald-500"
                      style={{
                        width: `${Math.min(100, Math.max(stat.percentage, stat.count > 0 ? 2 : 0))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ThailandMemberMap({ stats }: { stats: ProvinceStat[] }) {
  const locatedStats = stats.flatMap((stat) => {
    const coordinate = getThaiProvinceCoordinate(stat.province);
    return coordinate ? [{ stat, coordinate }] : [];
  });
  const unmatchedStats = stats.filter(
    (stat) => !getThaiProvinceCoordinate(stat.province),
  );
  const maxCount = Math.max(1, ...locatedStats.map(({ stat }) => stat.count));

  const project = (latitude: number, longitude: number) => ({
    x: 25 + ((longitude - 97.2) / (105.7 - 97.2)) * 990,
    y: 25 + ((20.6 - latitude) / (20.6 - 5.5)) * 1790,
  });

  return (
    <div className="rounded-2xl border border-green-100 bg-gradient-to-b from-green-50 to-emerald-100/70 p-4 md:p-5">
      <div>
        <h3 className="text-lg font-black text-green-950 md:text-xl">
          แผนที่สมาชิกทั่วประเทศไทย
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          ขนาดหมุดสัมพันธ์กับจำนวนสมาชิกในจังหวัด
        </p>
      </div>

      <div className="relative mx-auto mt-4 max-w-[25rem] overflow-hidden rounded-2xl border border-white/70 bg-white/60 p-2 shadow-inner">
        <svg
          viewBox="0 0 1051.164 1849.133"
          role="img"
          aria-labelledby="thailand-member-map-title thailand-member-map-desc"
          className="h-auto w-full"
        >
          <title id="thailand-member-map-title">แผนที่ประเทศไทยแสดงสมาชิกแยกตามจังหวัด</title>
          <desc id="thailand-member-map-desc">
            หมุดแต่ละจุดแสดงจังหวัด จำนวนสมาชิก และเปอร์เซ็นต์ของสมาชิกทั้งหมด
          </desc>
          <defs>
            <filter id="member-marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.28" />
            </filter>
          </defs>
          <image
            href="/thailand-provinces-map.webp"
            width="1051.164"
            height="1849.133"
            aria-hidden="true"
            style={{ filter: "drop-shadow(0 18px 16px rgb(15 23 42 / 0.22))" }}
          />

          {locatedStats.map(({ stat, coordinate }) => {
            const point = project(coordinate.latitude, coordinate.longitude);
            const radius = 24 + Math.sqrt(stat.count / maxCount) * 20;
            return (
              <g
                key={stat.province}
                data-province-marker={stat.province}
                transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                filter="url(#member-marker-shadow)"
              >
                <title>
                  {stat.province}: {stat.count.toLocaleString("th-TH")} คน ({stat.percentage.toFixed(1)}%)
                </title>
                <circle r={radius + 11} fill="#facc15" opacity="0.35" />
                <circle r={radius} fill="#166534" stroke="#facc15" strokeWidth="7" />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={stat.count > 99 ? 24 : 29}
                  fontWeight="800"
                >
                  {stat.count > 999 ? "999+" : stat.count}
                </text>
              </g>
            );
          })}
        </svg>

        {locatedStats.length === 0 && (
          <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl bg-white/95 p-4 text-center text-sm font-semibold text-slate-600 shadow">
            ยังไม่มีข้อมูลจังหวัดสำหรับแสดงหมุดบนแผนที่
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-full border-2 border-yellow-400 bg-green-800" />
          จังหวัดที่มีสมาชิก
        </span>
        <span>หมุดใหญ่ = สมาชิกมาก</span>
      </div>

      {unmatchedStats.length > 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          ไม่พบตำแหน่งบนแผนที่: {unmatchedStats.map((stat) => stat.province).join(", ")}
        </p>
      )}
    </div>
  );
}

function ProvinceSummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-green-100 bg-green-50 p-4">
      <p className="text-sm font-bold text-green-800">{label}</p>
      <p className="mt-2 text-2xl font-black text-green-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function PackageCard({
  href,
  active,
  label,
  value,
  detail,
}: {
  href: string;
  active: boolean;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-700/30 ${
        active
          ? "border-green-700 bg-green-50 ring-2 ring-green-700/20"
          : "border-green-100 bg-white"
      }`}
    >
      <p className="text-sm font-bold uppercase tracking-wide text-green-800">{label}</p>
      <p className="mt-2 text-3xl font-black text-green-950">
        {value.toLocaleString("th-TH")} <span className="text-base font-semibold">คน</span>
      </p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </Link>
  );
}
