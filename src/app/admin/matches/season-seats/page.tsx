import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { SEASON_LABEL, SEASON_TIERS } from "@/lib/season-pass-tiers";
import SeasonPassZoneQuotaForm from "./SeasonPassZoneQuotaForm";

export const dynamic = "force-dynamic";

export default async function SeasonPassZoneQuotasPage() {
  await verifyPermission("MATCHES");
  const tiers = SEASON_TIERS.filter((tier) => tier.inventory != null);
  const [quotas, soldGroups] = await Promise.all([
    prisma.seasonPassZoneQuota.findMany({ where: { seasonLabel: SEASON_LABEL } }),
    prisma.seasonPassOrder.groupBy({
      by: ["tierId", "seatZone"],
      where: {
        seasonLabel: SEASON_LABEL,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _count: { _all: true },
    }),
  ]);

  return (
    <div>
      <Link href="/admin/matches" className="text-sm font-medium text-slate-500 hover:text-slate-900">← กลับหน้าจัดการแมตช์</Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">จัดสรรที่นั่งบัตรรายปี</h1>
      <p className="mt-2 max-w-3xl text-base text-slate-600">
        ฤดูกาล {SEASON_LABEL} · กำหนดจำนวนรวมและที่นั่งสปอนเซอร์แยกแต่ละโซน โควตานี้ไม่เกี่ยวกับจำนวนที่นั่งรายแมตช์
      </p>

      <div className="mt-6 space-y-6">
        {tiers.map((tier) => {
          const inventory = tier.inventory!;
          return (
            <SeasonPassZoneQuotaForm
              key={tier.id}
              tierId={tier.id}
              badge={tier.badge}
              priceBaht={tier.priceBaht}
              targetTotal={inventory.total}
              zones={tier.allowedSeatZones.map((seatZone) => {
                const quota = quotas.find((row) => row.tierId === tier.id && row.seatZone === seatZone);
                const sold = soldGroups.find((row) => row.tierId === tier.id && row.seatZone === seatZone)?._count._all ?? 0;
                return {
                  seatZone,
                  totalSeats: quota?.totalSeats ?? null,
                  sponsorReserved: quota?.sponsorReserved ?? null,
                  sold,
                };
              })}
            />
          );
        })}
      </div>
    </div>
  );
}
