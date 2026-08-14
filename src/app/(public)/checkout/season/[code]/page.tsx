import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyCustomer } from "@/lib/customer-dal";
import { getSeasonTier } from "@/lib/season-pass-tiers";
import PaymentGateway from "../../[code]/PaymentGateway";
import { expirePendingSeasonPassPurchases } from "@/lib/season-pass-expiry";

export const dynamic = "force-dynamic";

export default async function SeasonPassCheckoutPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, customer] = await Promise.all([params, verifyCustomer()]);
  if (!code || !/^[A-Z0-9-]{8,100}$/i.test(code)) notFound();
  await expirePendingSeasonPassPurchases({ purchaseCode: code, passCode: code });

  const ownerWhere = {
    OR: [
      { customerId: customer.id },
      { customerEmail: { equals: customer.email, mode: "insensitive" as const } },
    ],
  };
  const purchase = await prisma.seasonPassPurchase.findFirst({
    where: { purchaseCode: code, ...ownerWhere },
    select: {
      purchaseCode: true,
      quantity: true,
      totalBaht: true,
      status: true,
      orders: {
        orderBy: { passCode: "asc" },
        select: {
          passCode: true,
          customerName: true,
          tierId: true,
          seatZone: true,
          seasonLabel: true,
        },
      },
    },
  });

  const legacyOrder = purchase
    ? null
    : await prisma.seasonPassOrder.findFirst({
        where: { passCode: code, ...ownerWhere },
        select: {
          passCode: true,
          customerName: true,
          tierId: true,
          seatZone: true,
          seasonLabel: true,
          priceBaht: true,
          shippingFeeBaht: true,
          status: true,
          purchase: { select: { purchaseCode: true } },
        },
      });

  if (!purchase && !legacyOrder) notFound();
  if (!purchase && legacyOrder?.purchase) {
    redirect(`/checkout/season/${encodeURIComponent(legacyOrder.purchase.purchaseCode)}`);
  }
  const firstOrder = purchase?.orders[0] ?? legacyOrder;
  if (!firstOrder) notFound();
  const status = purchase?.status ?? legacyOrder!.status;
  const checkoutCode = purchase?.purchaseCode ?? legacyOrder!.passCode;
  const passCodes = purchase?.orders.map((order) => order.passCode) ?? [legacyOrder!.passCode];
  const quantity = purchase?.quantity ?? 1;
  const total = purchase?.totalBaht ?? (legacyOrder!.priceBaht + legacyOrder!.shippingFeeBaht);

  if (status === "CONFIRMED") {
    redirect(quantity > 1 ? "/member/bookings" : `/tickets/season/${encodeURIComponent(firstOrder.passCode)}`);
  }
  if (status === "CANCELLED" || status === "REFUNDED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-black text-red-700">รายการนี้ไม่สามารถชำระเงินได้</h1>
        <Link href="/member/bookings" className="mt-6 inline-flex rounded-full bg-green-800 px-6 py-3 font-bold text-yellow-300">
          กลับไปบัตรของฉัน
        </Link>
      </div>
    );
  }

  const tier = getSeasonTier(firstOrder.tierId);
  const successUrl = quantity > 1
    ? "/member/bookings"
    : `/tickets/season/${encodeURIComponent(firstOrder.passCode)}`;

  return (
    <div className="bg-slate-50 py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6">
          <p className="text-base font-bold uppercase tracking-widest text-yellow-600 md:text-lg">Season Pass</p>
          <h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl">ชำระเงินบัตรรายปี</h1>
          <p className="mt-3 text-lg text-slate-600 md:text-xl">
            ชำระผ่าน Beam PromptPay QR ครั้งเดียวสำหรับบัตรทั้งหมด {quantity} ใบ
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <PaymentGateway
            seasonPassCode={checkoutCode}
            amountBaht={total}
            successUrl={successUrl}
          />
          <aside className="h-fit rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
            <p className="text-sm font-bold uppercase tracking-widest text-green-700">สรุปคำสั่งซื้อ</p>
            <h2 className="mt-2 text-2xl font-bold text-green-900">{tier?.name ?? firstOrder.tierId}</h2>
            <p className="mt-1 text-base text-slate-600">ฤดูกาล {firstOrder.seasonLabel}</p>
            <div className="my-5 border-t border-dashed border-slate-200" />
            <Row label="ผู้สมัคร" value={firstOrder.customerName} />
            <Row label="จำนวน" value={`${quantity} ใบ`} />
            <Row label="โซนที่นั่ง" value={firstOrder.seatZone} />
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">หมายเลขบัตร</p>
              <ul className="mt-2 space-y-1">
                {passCodes.map((passCode) => (
                  <li key={passCode} className="font-mono text-sm font-bold text-green-900">{passCode}</li>
                ))}
              </ul>
            </div>
            <div className="my-4 border-t border-slate-200" />
            <div className="flex items-baseline justify-between">
              <span className="text-lg text-slate-600">ยอดที่ต้องชำระ</span>
              <span className="text-4xl font-black text-green-900">฿{total.toLocaleString("th-TH")}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-base">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
