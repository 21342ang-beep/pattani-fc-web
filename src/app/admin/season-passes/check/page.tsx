import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { SEASON_MATCHES, SEASON_TIERS } from "@/lib/season-pass-tiers";
import { isPattaniHomeTeam } from "@/lib/season-pass-home-match";
import SeasonPassScanner from "./SeasonPassScanner";
import DeleteSeasonPassScanButton from "./DeleteSeasonPassScanButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "สแกนบัตรรายปี — Admin" };

export default async function SeasonPassCheckPage() {
  await verifyPermission("SEASON_PASSES");
  const [matches, orders, scans] = await Promise.all([
    prisma.match.findMany({ where: { competitionType: "LEAGUE", status: { in: ["ON_SALE", "SCHEDULED", "SOLD_OUT"] } }, orderBy: { kickoffAt: "asc" }, take: 100, select: { id: true, homeTeam: true, awayTeam: true, kickoffAt: true } }),
    prisma.seasonPassOrder.findMany({ select: { tierId: true } }),
    prisma.seasonPassScan.findMany({ orderBy: { scannedAt: "desc" }, take: 100, select: { id: true, scannedAt: true, scannedBy: true, match: { select: { homeTeam: true, awayTeam: true } }, barcode: { select: { tierId: true, order: { select: { passCode: true, customerName: true } } } } } }),
  ]);
  const tiers = SEASON_TIERS.filter((tier) => tier.id !== "vvip-elite");
  const summaries = tiers.map((tier) => ({ id: tier.id, badge: tier.badge, orders: orders.filter((order) => order.tierId === tier.id).length, scans: scans.filter((scan) => scan.barcode.tierId === tier.id).length }));

  return <div className="mx-auto max-w-6xl space-y-6">
    <header><Link href="/admin/season-passes" className="text-sm font-medium text-green-800 hover:underline">← กลับไปข้อมูลการซื้อบัตรรายปี</Link><h1 className="mt-1 text-2xl font-bold text-green-900">สแกนใช้งานบัตรรายปี</h1><p className="text-sm text-slate-600">ใช้ได้เฉพาะเกมเหย้าบอลลีกของ Pattani FC {SEASON_MATCHES} แมตช์เท่านั้น · บอลถ้วยและเกมเยือนไม่รวมสิทธิ์บัตรรายปี</p></header>
    <SeasonPassScanner matches={matches.filter((match) => isPattaniHomeTeam(match.homeTeam)).slice(0, SEASON_MATCHES).map((match) => ({ id: match.id, label: `${match.homeTeam} vs ${match.awayTeam}${match.kickoffAt ? ` · ${formatDateTime(match.kickoffAt)}` : ""}` }))} summaries={summaries} />
    <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-green-900">ประวัติการใช้งานบัตรรายปี</h2><p className="mt-1 text-sm text-slate-600">ลบรายการเพื่อทดสอบได้ โดยระบบจะคืนสิทธิ์ให้บัตร 1 แมตช์</p><div className="mt-4 overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-sm"><thead className="border-b bg-slate-50 text-left text-xs uppercase"><tr><th className="px-3 py-2">เวลาสแกน</th><th className="px-3 py-2">รหัสบัตร</th><th className="px-3 py-2">ผู้ซื้อ</th><th className="px-3 py-2">แพ็กเกจ</th><th className="px-3 py-2">แมตช์</th><th className="px-3 py-2 text-right">ทดสอบ</th></tr></thead><tbody>{scans.map((scan) => <tr key={scan.id} className="border-b last:border-0"><td className="px-3 py-2 text-slate-600">{formatDateTime(scan.scannedAt)}</td><td className="px-3 py-2 font-mono text-xs">{scan.barcode.order?.passCode ?? "—"}</td><td className="px-3 py-2">{scan.barcode.order?.customerName ?? "—"}</td><td className="px-3 py-2">{SEASON_TIERS.find((tier) => tier.id === scan.barcode.tierId)?.badge ?? scan.barcode.tierId}</td><td className="px-3 py-2">{scan.match.homeTeam} vs {scan.match.awayTeam}</td><td className="px-3 py-2 text-right"><DeleteSeasonPassScanButton scanId={scan.id} /></td></tr>)}{scans.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">ยังไม่มีประวัติการสแกนบัตรรายปี</td></tr>}</tbody></table></div></section>
  </div>;
}
