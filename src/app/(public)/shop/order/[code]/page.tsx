import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { buildPromptPayPayload } from "@/lib/promptpay";
import { formatBaht } from "@/lib/format";
import PageHero from "../../../_components/PageHero";
import PhoneGate from "./PhoneGate";
import ConfirmPaidButton from "./ConfirmPaidButton";

export const dynamic = "force-dynamic";

const CLUB_PROMPTPAY = "0812345678";

const STATUS_LABEL: Record<string, { th: string; tone: string }> = {
  PENDING: { th: "รอชำระเงิน", tone: "bg-amber-100 text-amber-800" },
  PAID: { th: "ชำระแล้ว · รอจัดส่ง", tone: "bg-emerald-100 text-emerald-800" },
  PROCESSING: { th: "กำลังเตรียมพัสดุ", tone: "bg-sky-100 text-sky-800" },
  SHIPPED: { th: "จัดส่งแล้ว", tone: "bg-indigo-100 text-indigo-800" },
  DELIVERED: { th: "ส่งถึงปลายทาง", tone: "bg-green-100 text-green-800" },
  CANCELLED: { th: "ยกเลิก", tone: "bg-rose-100 text-rose-800" },
  REFUNDED: { th: "คืนเงินแล้ว", tone: "bg-slate-100 text-slate-700" },
};

const SHIPPING_LABEL: Record<string, string> = {
  STANDARD: "ไปรษณีย์ไทย / EMS",
  EXPRESS: "ส่งด่วน (Kerry / Flash)",
  PICKUP: "รับเองที่สโมสร",
};

const PAYMENT_LABEL: Record<string, string> = {
  PROMPTPAY: "PromptPay QR",
  BANK_TRANSFER: "โอนผ่านธนาคาร",
  COD: "เก็บปลายทาง",
};

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

export default async function ShopOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { code } = await params;
  const { phone } = await searchParams;

  if (!code || !/^[a-z0-9]+$/i.test(code)) notFound();

  const order = await prisma.shopOrder.findUnique({
    where: { orderCode: code },
    include: { items: true },
  });
  if (!order) notFound();

  if (!phone || normalizePhone(order.customerPhone) !== normalizePhone(phone)) {
    return <PhoneGate code={code} />;
  }

  const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.PENDING;
  const totalBaht = order.totalAmount / 100;
  const showPaymentBlock = order.status === "PENDING";
  const showPromptPay = showPaymentBlock && order.paymentMethod === "PROMPTPAY";
  const showBank = showPaymentBlock && order.paymentMethod === "BANK_TRANSFER";

  let qrSvg: string | null = null;
  if (showPromptPay) {
    const payload = buildPromptPayPayload({
      target: CLUB_PROMPTPAY,
      amountBaht: totalBaht,
    });
    qrSvg = await QRCode.toString(payload, {
      type: "svg",
      margin: 1,
      width: 240,
      color: { dark: "#052e1b", light: "#ffffff" },
    });
  }

  return (
    <>
      <PageHero
        title="คำสั่งซื้อ"
        subtitle={`รหัสออเดอร์: ${order.orderCode}`}
      />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-black text-green-900">สถานะ</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${status.tone}`}
                >
                  {status.th}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <Row label="ลูกค้า" value={order.customerName} />
                <Row label="เบอร์โทร" value={order.customerPhone} />
                {order.customerEmail && <Row label="อีเมล" value={order.customerEmail} />}
                <Row
                  label="วิธีจัดส่ง"
                  value={SHIPPING_LABEL[order.shippingMethod] ?? order.shippingMethod}
                />
                <Row
                  label="วิธีชำระเงิน"
                  value={PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                />
                {order.trackingNumber && (
                  <Row label="หมายเลขพัสดุ" value={order.trackingNumber} />
                )}
              </dl>

              {order.shippingMethod !== "PICKUP" && order.shipAddress && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    ที่อยู่จัดส่ง
                  </p>
                  <p className="mt-1 text-slate-800">
                    {order.shipAddress} {order.shipCity ?? ""} {order.shipProvince ?? ""}{" "}
                    {order.shipPostalCode ?? ""}
                  </p>
                  {order.shipNote && (
                    <p className="mt-1 text-xs text-slate-500">
                      หมายเหตุ: {order.shipNote}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-base font-black text-green-900">รายการสินค้า</h2>
              <ul className="mt-4 space-y-3">
                {order.items.map((it) => (
                  <li key={it.id} className="flex gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                      {it.imageUrl ? (
                        <Image
                          src={it.imageUrl}
                          alt={it.productName}
                          fill
                          unoptimized
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-green-900">
                        {it.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {it.size && <>ไซส์ {it.size} · </>}
                        {formatBaht(it.unitPrice)} × {it.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-green-900">
                      {formatBaht(it.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-1 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">ยอดสินค้า</span>
                  <span>{formatBaht(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ค่าจัดส่ง</span>
                  <span>
                    {order.shippingFee === 0 ? "ฟรี" : formatBaht(order.shippingFee)}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
                  <span className="text-base font-bold text-green-900">รวมทั้งสิ้น</span>
                  <span className="text-2xl font-black text-green-900">
                    {formatBaht(order.totalAmount)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Payment instruction */}
          <aside className="h-fit space-y-4 rounded-2xl border-2 border-green-100 bg-white p-5 shadow-sm md:sticky md:top-6">
            {showPromptPay && qrSvg && (
              <div>
                <h2 className="text-base font-black text-green-900">
                  สแกน PromptPay
                </h2>
                <p className="text-xs text-slate-500">
                  ยอด {formatBaht(order.totalAmount)} · พร้อมเพย์ {CLUB_PROMPTPAY}
                </p>
                <div
                  className="mx-auto mt-3 size-56 [&_svg]:h-full [&_svg]:w-full"
                  // QR svg มาจาก server (qrcode lib) — ไม่ใช่ input user → ปลอดภัย
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                  aria-label="PromptPay QR code"
                />
                <ConfirmPaidButton orderCode={order.orderCode} phone={order.customerPhone} />
              </div>
            )}

            {showBank && (
              <div>
                <h2 className="text-base font-black text-green-900">โอนเงิน</h2>
                <p className="mt-1 text-xs text-slate-500">
                  ยอดที่ต้องโอน {formatBaht(order.totalAmount)}
                </p>
                <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <Row label="ธนาคาร" value="กรุงไทย (KTB)" />
                  <Row label="เลขที่บัญชี" value="123-4-56789-0" />
                  <Row label="ชื่อบัญชี" value="สโมสรปัตตานี เอฟซี" />
                </dl>
                <p className="mt-3 text-[11px] text-slate-500">
                  โอนแล้วกดปุ่ม &quot;ฉันชำระแล้ว&quot; ทีมงานจะตรวจสอบสลิปและอัปเดตสถานะ
                </p>
                <ConfirmPaidButton orderCode={order.orderCode} phone={order.customerPhone} />
              </div>
            )}

            {showPaymentBlock && order.paymentMethod === "COD" && (
              <div>
                <h2 className="text-base font-black text-green-900">เก็บปลายทาง</h2>
                <p className="mt-2 text-sm text-slate-600">
                  เตรียมเงินสด <strong>{formatBaht(order.totalAmount)}</strong> ให้พนักงานส่งของเมื่อรับพัสดุ
                </p>
                <p className="mt-3 text-[11px] text-slate-500">
                  ทีมงานจะติดต่อยืนยันออเดอร์ภายใน 1 วันทำการ
                </p>
              </div>
            )}

            {!showPaymentBlock && (
              <div>
                <h2 className="text-base font-black text-green-900">
                  ขอบคุณที่สั่งซื้อ
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  ทีมงานจะอัปเดตสถานะการจัดส่งเมื่อพัสดุพร้อมออก
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
