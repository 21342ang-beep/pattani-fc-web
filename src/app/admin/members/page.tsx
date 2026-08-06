import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import {
  SEASON_LABEL,
  SEASON_TIERS,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import DeleteMemberButton from "./DeleteMemberButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "ข้อมูลผู้ใช้งาน — Pattani FC Admin" };

type TierFilter = "all" | "none" | SeasonTierId;

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
      <div>
        <h1 className="text-3xl font-bold text-green-900 md:text-4xl">ข้อมูลสมาชิก</h1>
        <p className="mt-1 text-base text-slate-600 md:text-lg">
          จำแนกสมาชิกตามแพ็กเกจบัตรรายปี ฤดูกาล {SEASON_LABEL}
        </p>
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
