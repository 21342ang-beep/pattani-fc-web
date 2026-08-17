import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { SEASON_MATCHES, SEASON_TIERS } from "@/lib/season-pass-tiers";
import { isPattaniHomeTeam } from "@/lib/season-pass-home-match";
import SeasonPassScanner from "./SeasonPassScanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "สแกนบัตรรายปี — Admin" };

export default async function SeasonPassCheckPage() {
  await verifyPermission("SEASON_PASSES");

  const [matches, orders, activeBarcodes, scans] = await Promise.all([
    prisma.match.findMany({
      where: { competitionType: "LEAGUE" },
      orderBy: { kickoffAt: "asc" },
      select: { id: true, homeTeam: true, awayTeam: true, kickoffAt: true },
    }),
    prisma.seasonPassOrder.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { tierId: true, status: true },
    }),
    prisma.seasonPassBarcode.findMany({
      where: { isGenerated: true },
      select: { tierId: true, orderId: true },
    }),
    prisma.seasonPassScan.findMany({
      orderBy: { scannedAt: "desc" },
      take: 100,
      select: {
        id: true,
        scannedAt: true,
        match: { select: { homeTeam: true, awayTeam: true } },
        barcode: { select: { barcode: true, tierId: true, order: { select: { passCode: true, customerName: true } } } },
      },
    }),
  ]);

  const tiers = SEASON_TIERS;
  const summaries = tiers.map((tier) => ({
    id: tier.id,
    badge: tier.badge,
    orders: tier.id === "vvip-elite"
      ? orders.filter((order) => order.tierId === tier.id && order.status === "CONFIRMED").length
      : orders.filter((order) => order.tierId === tier.id).length,
    unregistered: tier.id === "vvip-elite"
      ? activeBarcodes.filter((barcode) => barcode.tierId === tier.id && barcode.orderId === null).length
      : undefined,
    scans: scans.filter((scan) => scan.barcode.tierId === tier.id).length,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link href="/admin/season-passes" className="text-base font-medium text-green-800 hover:underline md:text-lg">
          ← กลับไปข้อมูลการซื้อบัตรรายปี
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-green-900 md:text-4xl">สแกนใช้งานบัตรรายปี</h1>
        <p className="text-base text-slate-600 md:text-lg">
          ใช้ได้เฉพาะเกมเหย้าบอลลีกของ Pattani FC {SEASON_MATCHES} แมตช์เท่านั้น · บอลถ้วยและเกมเยือนไม่รวมสิทธิ์บัตรรายปี
        </p>
        <Link
          href="/admin/season-passes/staff"
          className="mt-4 inline-flex rounded-lg bg-green-800 px-4 py-2.5 text-base font-bold text-yellow-300 hover:bg-green-900"
        >
          + จองบัตรรายปีให้ลูกค้า
        </Link>
      </header>

      <SeasonPassScanner
        matches={matches
          .filter((match) => isPattaniHomeTeam(match.homeTeam))
          .slice(0, SEASON_MATCHES)
          .map((match) => ({
            id: match.id,
            label: `${match.homeTeam} vs ${match.awayTeam}${match.kickoffAt ? ` · ${formatDateTime(match.kickoffAt)}` : ""}`,
          }))}
        summaries={summaries}
        scanHistory={scans.map((scan) => ({
          id: scan.id,
          scannedAt: scan.scannedAt.toISOString(),
          tierId: scan.barcode.tierId,
          passCode: scan.barcode.order?.passCode ?? scan.barcode.barcode,
          customerName: scan.barcode.order?.customerName ?? "VVIP 4,000 · ใช้งานภายใน",
          matchLabel: `${scan.match.homeTeam} vs ${scan.match.awayTeam}`,
        }))}
      />
    </div>
  );
}
