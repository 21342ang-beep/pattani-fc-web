import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { SEASON_TIERS } from "@/lib/season-pass-tiers";
import EditSeasonPassForm from "./EditSeasonPassForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขการจองบัตรรายปี — Admin" };

export default async function EditSeasonPassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  await verifyPermission("SEASON_PASSES");
  const [{ id }, { tier: returnTier }] = await Promise.all([params, searchParams]);
  const order = await prisma.seasonPassOrder.findUnique({ where: { id } });
  if (!order) notFound();
  const tier = SEASON_TIERS.find((item) => item.id === order.tierId);
  if (!tier) notFound();
  const backHref = `/admin/season-passes?tier=${returnTier || order.tierId}`;

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
          passCode: order.passCode,
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
        tierBadge={tier.badge}
        zones={[...tier.allowedSeatZones]}
        backHref={backHref}
      />
    </div>
  );
}
