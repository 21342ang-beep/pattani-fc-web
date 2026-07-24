import { notFound } from "next/navigation";
import Link from "next/link";
import bwipjs from "bwip-js/node";
import { prisma } from "@/lib/prisma";
import { getVerifiedBookingSearchOtp } from "@/lib/booking-search-otp";
import { formatBaht, formatDateTime } from "@/lib/format";
import TicketCard from "./TicketCard";
import PhoneGate from "./EmailGate";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!code || !/^[a-z0-9]+$/i.test(code)) notFound();

  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    select: {
      bookingCode: true,
      customerName: true,
      customerPhone: true,
      quantity: true,
      zone: true,
      totalAmount: true,
      status: true,
      seatNumbers: true,
      paymentMethod: true,
      paidAt: true,
      match: {
        select: {
          homeTeam: true,
          awayTeam: true,
          homeTeamLogo: true,
          awayTeamLogo: true,
          venue: true,
          kickoffAt: true,
        },
      },
    },
  });

  if (!booking) notFound();

  const verifiedOtp = await getVerifiedBookingSearchOtp(booking.customerPhone);
  if (!verifiedOtp) {
    return <PhoneGate />;
  }

  if (booking.status !== "CONFIRMED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-black text-amber-700">ยังไม่ได้ชำระเงิน</h1>
        <p className="mt-3 text-base text-slate-600">
          การจองนี้ยังไม่ได้ชำระเงิน หรือถูกยกเลิกแล้ว
        </p>
        <Link
          href={`/checkout/${code}`}
          className="mt-6 inline-flex rounded-full bg-yellow-400 px-6 py-3 text-base font-bold text-green-950 hover:bg-yellow-300"
        >
          ไปยังหน้าชำระเงิน
        </Link>
      </div>
    );
  }

  // Barcode (Code 128) สำหรับ scan ที่ประตูสนาม
  // - Code 128 รองรับ alphanumeric (cuid ของ bookingCode), dense, scanner เครื่องอ่านได้ทั่วไป
  // - แสดง code text ใต้ bar (includetext)
  const barcodeSvg = bwipjs.toSVG({
    bcid: "code128",
    text: booking.bookingCode,
    scale: 4,
    height: 18,
    includetext: true,
    textxalign: "center",
    textsize: 14,
    paddingwidth: 12,
    paddingheight: 6,
    barcolor: "052e1b",
    textcolor: "052e1b",
  });

  return (
    <TicketCard
      booking={{
        bookingCode: booking.bookingCode,
        customerName: booking.customerName,
        quantity: booking.quantity,
        zone: booking.zone,
        unitPrice: formatBaht(booking.totalAmount / booking.quantity),
        paymentMethod: booking.paymentMethod ?? "",
        paidAt: booking.paidAt?.toISOString() ?? "",
        match: {
          homeTeam: booking.match.homeTeam,
          awayTeam: booking.match.awayTeam,
          homeTeamLogo: booking.match.homeTeamLogo,
          awayTeamLogo: booking.match.awayTeamLogo,
          venue: booking.match.venue ?? "—",
          kickoffAt: booking.match.kickoffAt
            ? formatDateTime(booking.match.kickoffAt)
            : "—",
        },
      }}
      barcodeSvg={barcodeSvg}
    />
  );
}
