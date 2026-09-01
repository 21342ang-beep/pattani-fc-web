import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { SEASON_MATCHES, SEASON_TIERS } from "@/lib/season-pass-tiers";
import { isSeasonPassEligibleMatch } from "@/lib/season-pass-home-match";
import SeasonPassScanner from "./SeasonPassScanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "สแกนบัตรรายปี — Admin" };

export default async function SeasonPassCheckPage(props: {
  searchParams: Promise<{ match?: string }>;
}) {
  await verifyPermission("SEASON_PASSES");
  const { match: rawMatchId } = await props.searchParams;

  const [matches, orders, activeBarcodes] = await Promise.all([
    prisma.match.findMany({
      where: { seasonPassEligible: true },
      orderBy: { kickoffAt: "asc" },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        kickoffAt: true,
        competitionType: true,
        competitionName: true,
        competitionRound: true,
        seasonPassEligible: true,
      },
    }),
    prisma.seasonPassOrder.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { tierId: true, status: true },
    }),
    prisma.seasonPassBarcode.findMany({
      where: { isGenerated: true },
      select: { tierId: true, orderId: true },
    }),
  ]);

  const eligibleMatches = matches.filter(isSeasonPassEligibleMatch);
  const selectedMatch = eligibleMatches.find((match) => match.id === rawMatchId) ?? eligibleMatches[0];
  const scans = selectedMatch
    ? await prisma.seasonPassScan.findMany({
      where: { matchId: selectedMatch.id },
      orderBy: { scannedAt: "desc" },
      select: {
        id: true,
        scannedAt: true,
        barcode: {
          select: {
            barcode: true,
            tierId: true,
            order: { select: { passCode: true, customerName: true, seatZone: true } },
          },
        },
      },
    })
    : [];

  const tiers = SEASON_TIERS;
  const summaries = tiers.map((tier) => ({
    id: tier.id,
    badge: tier.badge,
    zones: [...tier.allowedSeatZones],
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
          บอลลีกหักสิทธิ์จากโควตา {SEASON_MATCHES} นัด · บอลถ้วยที่สโมสรเปิดสิทธิ์เป็นรายแมตช์จะไม่หักโควตาบอลลีก
        </p>
        <Link
          href="/admin/season-passes/staff"
          className="mt-4 inline-flex rounded-lg bg-green-800 px-4 py-2.5 text-base font-bold text-yellow-300 hover:bg-green-900"
        >
          + จองบัตรรายปีให้ลูกค้า
        </Link>
      </header>

      <SeasonPassScanner
        matches={eligibleMatches.map((match) => ({
            id: match.id,
            label: `${match.homeTeam} vs ${match.awayTeam}${match.kickoffAt ? ` · ${formatDateTime(match.kickoffAt)}` : ""}`,
            competitionType: match.competitionType,
            competitionName: match.competitionName,
            competitionRound: match.competitionRound,
          }))}
        initialMatchId={selectedMatch?.id ?? ""}
        summaries={summaries}
        scanHistory={scans.map((scan) => ({
          id: scan.id,
          scannedAt: scan.scannedAt.toISOString(),
          tierId: scan.barcode.tierId,
          seatZone: scan.barcode.order?.seatZone ?? null,
          passCode: scan.barcode.order?.passCode ?? scan.barcode.barcode,
          customerName: scan.barcode.order?.customerName ?? "VVIP 4,000 · ใช้งานภายใน",
          matchLabel: selectedMatch ? `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}` : "",
          competitionType: selectedMatch?.competitionType ?? "LEAGUE",
          competitionDetail: selectedMatch
            ? [selectedMatch.competitionName, selectedMatch.competitionRound].filter(Boolean).join(" · ") || null
            : null,
        }))}
      />
    </div>
  );
}
