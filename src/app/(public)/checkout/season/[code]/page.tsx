import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyCustomer } from "@/lib/customer-dal";
import { getSeasonTier } from "@/lib/season-pass-tiers";
import PaymentGateway from "../../[code]/PaymentGateway";

export const dynamic = "force-dynamic";

export default async function SeasonPassCheckoutPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, customer] = await Promise.all([params, verifyCustomer()]);
  if (!code || !/^PFC26-[A-Z0-9-]+$/i.test(code)) notFound();

  const order = await prisma.seasonPassOrder.findFirst({
    where: {
      passCode: code,
      OR: [
        { customerId: customer.id },
        { customerEmail: { equals: customer.email, mode: "insensitive" } },
      ],
    },
    select: {
      passCode: true,
      customerName: true,
      tierId: true,
      seatZone: true,
      seasonLabel: true,
      priceBaht: true,
      shippingFeeBaht: true,
      status: true,
    },
  });
  if (!order) notFound();
  if (order.status === "CONFIRMED") redirect(`/tickets/season/${encodeURIComponent(order.passCode)}`);
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="text-3xl font-black text-red-700">รายการนี้ไม่สามารถชำระเงินได้</h1><Link href="/member/bookings" className="mt-6 inline-flex rounded-full bg-green-800 px-6 py-3 font-bold text-yellow-300">กลับไปบัตรของฉัน</Link></div>;
  }

  const total = order.priceBaht + order.shippingFeeBaht;
  const tier = getSeasonTier(order.tierId);
  return (
    <div className="bg-slate-50 py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6">
          <p className="text-base font-bold uppercase tracking-widest text-yellow-600 md:text-lg">Season Pass</p>
          <h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl">ชำระเงินบัตรรายปี</h1>
          <p className="mt-3 text-lg text-slate-600 md:text-xl">ชำระผ่าน PromptPay และรับบัตรอิเล็กทรอนิกส์ทันทีเมื่อ Xendit ยืนยันรายการ</p>
        </div>
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <PaymentGateway seasonPassCode={order.passCode} amountBaht={total} />
          <aside className="h-fit rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
            <p className="text-sm font-bold uppercase tracking-widest text-green-700">สรุปคำสั่งซื้อ</p>
            <h2 className="mt-2 text-2xl font-bold text-green-900">{tier?.name ?? order.tierId}</h2>
            <p className="mt-1 text-base text-slate-600">ฤดูกาล {order.seasonLabel}</p>
            <div className="my-5 border-t border-dashed border-slate-200" />
            <Row label="ผู้สมัคร" value={order.customerName} />
            <Row label="รหัสบัตร" value={order.passCode} mono />
            <Row label="โซนที่นั่ง" value={order.seatZone} />
            {order.shippingFeeBaht > 0 && <Row label="ค่าจัดส่ง" value={`฿${order.shippingFeeBaht.toLocaleString("th-TH")}`} />}
            <div className="my-4 border-t border-slate-200" />
            <div className="flex items-baseline justify-between"><span className="text-lg text-slate-600">ยอดที่ต้องชำระ</span><span className="text-4xl font-black text-green-900">฿{total.toLocaleString("th-TH")}</span></div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-start justify-between gap-3 py-2 text-base"><span className="text-slate-500">{label}</span><span className={`text-right text-slate-900 ${mono ? "font-mono text-sm" : "font-medium"}`}>{value}</span></div>;
}
