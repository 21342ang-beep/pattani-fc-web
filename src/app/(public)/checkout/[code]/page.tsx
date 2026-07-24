import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDateTime } from "@/lib/format";
import { buildPromptPayPayload } from "@/lib/promptpay";
import QRCode from "qrcode";
import PaymentGateway from "./PaymentGateway";

export const dynamic = "force-dynamic";

const CLUB_PROMPTPAY = "0812345678";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!code || !/^[a-z0-9]+$/i.test(code)) notFound();

  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    select: {
      id: true,
      bookingCode: true,
      customerName: true,
      customerPhone: true,
      quantity: true,
      totalAmount: true,
      status: true,
      match: { select: { homeTeam: true, awayTeam: true, venue: true, kickoffAt: true } },
    },
  });

  if (!booking) notFound();

  if (booking.status === "CONFIRMED") {
    redirect(`/tickets/${code}`);
  }

  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-black text-red-700">การจองนี้ถูกยกเลิกแล้ว</h1>
        <p className="mt-3 text-base text-slate-600">
          กรุณาทำรายการจองใหม่หากต้องการชำระเงิน
        </p>
      </div>
    );
  }

  const amountBaht = booking.totalAmount / 100;
  const ppPayload = buildPromptPayPayload({
    target: CLUB_PROMPTPAY,
    amountBaht,
  });
  const qrSvg = await QRCode.toString(ppPayload, {
    type: "svg",
    margin: 1,
    width: 280,
    color: { dark: "#052e1b", light: "#ffffff" },
  });

  return (
    <div className="bg-slate-50 py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6">
          <p className="text-base font-bold uppercase tracking-widest text-yellow-600 md:text-lg">
            ชำระเงิน
          </p>
          <h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">
            ดำเนินการชำระเงิน
          </h1>
          <p className="mt-3 text-lg text-slate-600 md:text-xl">
            เลือกวิธีชำระเงินที่สะดวก — รับ E-Ticket ทันทีหลังชำระสำเร็จ
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <PaymentGateway
              bookingCode={booking.bookingCode}
              phone={booking.customerPhone}
              amountBaht={amountBaht}
              qrSvg={qrSvg}
              promptpay={CLUB_PROMPTPAY}
            />
          </div>

          <aside className="h-fit rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-8">
            <p className="text-sm font-bold uppercase tracking-widest text-green-700 md:text-base">
              สรุปคำสั่งซื้อ
            </p>
            <h3 className="mt-2 text-2xl font-bold text-green-900 md:text-3xl">
              {booking.match.homeTeam} <span className="text-slate-400">vs</span>{" "}
              {booking.match.awayTeam}
            </h3>
            <p className="mt-2 text-base text-slate-600 md:text-lg">{booking.match.venue ?? "—"}</p>
            <p className="text-base text-slate-600 md:text-lg">
              {booking.match.kickoffAt ? formatDateTime(booking.match.kickoffAt) : "—"}
            </p>

            <div className="my-5 border-t border-dashed border-slate-200" />

            <Row label="ผู้จอง" value={booking.customerName} />
            <Row label="รหัสการจอง" value={booking.bookingCode} mono />
            <Row label="จำนวน" value={`${booking.quantity} ใบ`} />

            <div className="my-4 border-t border-slate-200" />

            <div className="flex items-baseline justify-between">
              <span className="text-lg text-slate-600 md:text-xl">ยอดที่ต้องชำระ</span>
              <span className="text-4xl font-black text-green-900 md:text-5xl">
                {formatBaht(booking.totalAmount)}
              </span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-base md:text-lg">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-slate-900 ${mono ? "font-mono text-sm md:text-base" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
