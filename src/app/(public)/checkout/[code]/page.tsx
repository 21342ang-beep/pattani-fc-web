import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDateTime } from "@/lib/format";
import { buildPromptPayPayload } from "@/lib/promptpay";
import QRCode from "qrcode";
import PaymentGateway from "./PaymentGateway";
import PhoneGate from "./EmailGate";

export const dynamic = "force-dynamic";

const CLUB_PROMPTPAY = "0812345678";

// ตัด non-digit → ทนต่อรูปแบบเบอร์ที่ต่างกัน (081-234-5678 vs 0812345678)
function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { code } = await params;
  const { phone } = await searchParams;

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

  // gate ด้วยเบอร์ (universal — รองรับทั้ง member + guest)
  if (!phone || normalizePhone(booking.customerPhone) !== normalizePhone(phone)) {
    return <PhoneGate code={code} />;
  }

  if (booking.status === "CONFIRMED") {
    redirect(`/tickets/${code}?phone=${encodeURIComponent(phone)}`);
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
    <div className="bg-slate-50 py-10 md:py-14">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-widest text-yellow-600">
            ชำระเงิน
          </p>
          <h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl">
            ดำเนินการชำระเงิน
          </h1>
          <p className="mt-2 text-base text-slate-600">
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

          <aside className="h-fit rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700">
              สรุปคำสั่งซื้อ
            </p>
            <h3 className="mt-2 text-xl font-bold text-green-900">
              {booking.match.homeTeam} <span className="text-slate-400">vs</span>{" "}
              {booking.match.awayTeam}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{booking.match.venue ?? "—"}</p>
            <p className="text-sm text-slate-600">
              {booking.match.kickoffAt ? formatDateTime(booking.match.kickoffAt) : "—"}
            </p>

            <div className="my-5 border-t border-dashed border-slate-200" />

            <Row label="ผู้จอง" value={booking.customerName} />
            <Row label="รหัสการจอง" value={booking.bookingCode} mono />
            <Row label="จำนวน" value={`${booking.quantity} ใบ`} />

            <div className="my-4 border-t border-slate-200" />

            <div className="flex items-baseline justify-between">
              <span className="text-base text-slate-600">ยอดที่ต้องชำระ</span>
              <span className="text-3xl font-black text-green-900">
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
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-slate-900 ${mono ? "font-mono text-xs" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
