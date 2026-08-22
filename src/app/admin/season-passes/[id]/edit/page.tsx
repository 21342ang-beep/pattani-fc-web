import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { SEASON_TIERS } from "@/lib/season-pass-tiers";
import {
  getSeasonPassZoneBarcodeBounds,
  resolveSeasonPassBarcodeZoneQuotas,
  seasonPassBarcodeIsWithinBounds,
} from "@/lib/season-pass-zone-ranges";
import EditSeasonPassForm from "./EditSeasonPassForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขการจองบัตรรายปี — Admin" };

export default async function EditSeasonPassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string; from?: string }>;
}) {
  await verifyPermission("SEASON_PASSES");
  const [{ id }, { tier: returnTier, from }] = await Promise.all([params, searchParams]);
  const order = await prisma.seasonPassOrder.findUnique({
    where: { id },
    include: { barcode: { select: { barcode: true } } },
  });
  if (!order) notFound();
  const tier = SEASON_TIERS.find((item) => item.id === order.tierId);
  if (!tier) notFound();
  const backHref = from === "staff"
    ? "/admin/season-passes/staff"
    : `/admin/season-passes?tier=${returnTier || order.tierId}`;
  const [zoneQuotas, members] = await Promise.all([
    prisma.seasonPassZoneQuota.findMany({
      where: {
        seasonLabel: order.seasonLabel,
        tierId: { in: SEASON_TIERS.map((item) => item.id) },
      },
      select: { tierId: true, seatZone: true, totalSeats: true, sponsorReserved: true },
    }),
    order.salesChannel === "OFFLINE"
      ? prisma.customer.findMany({
          orderBy: [{ name: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true, phone: true, email: true },
        })
      : Promise.resolve([]),
  ]);
  const tierBarcodeDetails = SEASON_TIERS.map((item) => {
    const barcodePrefix = `PFC26-${item.priceBaht}-`;
    const itemQuotas = zoneQuotas.filter((quota) => quota.tierId === item.id);
    const barcodeZoneQuotas = resolveSeasonPassBarcodeZoneQuotas(
      order.seasonLabel,
      item.id,
      barcodePrefix,
      item.allowedSeatZones,
      itemQuotas,
    );
    const zoneBounds = item.allowedSeatZones.flatMap((seatZone) => {
      const bounds = getSeasonPassZoneBarcodeBounds(
        barcodePrefix,
        item.allowedSeatZones,
        barcodeZoneQuotas,
        seatZone,
      );
      return bounds ? [bounds] : [];
    });
    return {
      tier: item,
      zoneBounds,
      hasCompleteZoneBarcodeRanges:
        zoneBounds.length === item.allowedSeatZones.length,
    };
  });
  const barcodeRangeFilters = tierBarcodeDetails.flatMap((detail) =>
    detail.hasCompleteZoneBarcodeRanges
      ? detail.zoneBounds
          .filter((bounds) => bounds.publicSeatCount > 0)
          .map((bounds) => ({
            tierId: detail.tier.id,
            barcode: { gte: bounds.lowerBound, lte: bounds.upperBound },
          }))
      : [],
  );
  const availableBarcodeRows = barcodeRangeFilters.length > 0
    ? await prisma.seasonPassBarcode.findMany({
        where: {
          seasonLabel: order.seasonLabel,
          isGenerated: true,
          orderId: null,
          scans: { none: {} },
          OR: barcodeRangeFilters,
        },
        orderBy: { barcode: "asc" },
        select: { tierId: true, barcode: true },
      })
    : [];
  const tierOptions = tierBarcodeDetails.map((detail) => ({
    id: detail.tier.id,
    badge: detail.tier.badge,
    priceBaht: detail.tier.priceBaht,
    zones: [...detail.tier.allowedSeatZones],
    hasCompleteZoneBarcodeRanges: detail.hasCompleteZoneBarcodeRanges,
    availableBarcodes: availableBarcodeRows.flatMap((item) => {
      if (item.tierId !== detail.tier.id) return [];
      const bounds = detail.zoneBounds.find((candidate) =>
        seasonPassBarcodeIsWithinBounds(item.barcode, candidate),
      );
      return bounds ? [{ barcode: item.barcode, seatZone: bounds.seatZone }] : [];
    }),
  }));
  const currentTierDetails = tierBarcodeDetails.find(
    (detail) => detail.tier.id === order.tierId,
  )!;
  const barcodeSeatZone = order.barcode
    ? currentTierDetails.zoneBounds.find((bounds) =>
        seasonPassBarcodeIsWithinBounds(order.barcode!.barcode, bounds),
      )?.seatZone ?? ""
    : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link href={backHref} className="text-base font-medium text-green-800 hover:underline">
          ← กลับหน้าบัตรรายปี
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-green-900 md:text-4xl">แก้ไขการจองบัตรรายปี</h1>
        <p className="mt-1 text-base text-slate-600 md:text-lg">
          {tier.badge} · <span className="font-mono">{order.passCode}</span>
        </p>
      </header>
      <EditSeasonPassForm
        order={{
          id: order.id,
          tierId: order.tierId,
          priceBaht: order.priceBaht,
          passCode: order.passCode,
          barcode: order.barcode?.barcode ?? "",
          barcodeSeatZone,
          customerId: order.customerId ?? "",
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail ?? "",
          seatZone: order.seatZone,
          seatNumber: order.seatNumber ?? "",
          shirtSize: order.shirtSize ?? "",
          deliveryMethod: order.deliveryMethod,
          shipAddress: order.shipAddress ?? "",
          shipCity: order.shipCity ?? "",
          shipProvince: order.shipProvince ?? "",
          shipPostalCode: order.shipPostalCode ?? "",
          shipNote: order.shipNote ?? "",
          pickupLocation: order.pickupLocation ?? "",
          paymentMethod: order.paymentMethod,
          offlineReceiptNo: order.offlineReceiptNo ?? "",
          notes: order.notes ?? "",
          salesChannel: order.salesChannel,
        }}
        tierOptions={tierOptions}
        members={members}
        backHref={backHref}
      />
    </div>
  );
}
