import { prisma } from "@/lib/prisma";
import { expirePendingBookings } from "@/lib/booking-expiry";
import { expirePendingSeasonPassPurchases } from "@/lib/season-pass-expiry";
import { jsonNoStore, paymentTargetNotFound, rateLimitedJson } from "@/lib/payment-http";
import { rateLimit } from "@/lib/rate-limit";
import { hasBookingAccess } from "@/lib/booking-access";
import { hasSeasonPaymentAccess } from "@/lib/season-payment-access";

export async function GET(request: Request) {
  // The checkout polls every three seconds. Keep a shared per-IP ceiling while
  // allowing legitimate customers behind mobile carrier NAT to poll together.
  const rl = await rateLimit("beam_payment_status", { max: 1_200, windowMs: 60_000 });
  if (!rl.ok) return rateLimitedJson(rl.retryAfterSec);
  const params = new URL(request.url).searchParams;
  const bookingCode = params.get("bookingCode")?.trim();
  const seasonPassCode = params.get("seasonPassCode")?.trim();

  if (Boolean(bookingCode) === Boolean(seasonPassCode)) {
    return jsonNoStore({ error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, { status: 400 });
  }

  if (bookingCode) {
    if (!/^[a-z0-9]{8,50}$/i.test(bookingCode)) return jsonNoStore({ error: "ข้อมูลการจองไม่ถูกต้อง" }, { status: 400 });
    await expirePendingBookings({ bookingCode });
    const booking = await prisma.booking.findUnique({
      where: { bookingCode },
      select: {
        id: true,
        bookingCode: true,
        customerId: true,
        customerPhone: true,
        status: true,
      },
    });
    if (!booking || !(await hasBookingAccess(booking))) {
      return paymentTargetNotFound();
    }
    return jsonNoStore({
      confirmed: booking.status === "CONFIRMED",
      expired: booking.status === "CANCELLED",
    });
  }

  if (!seasonPassCode || !/^[a-z0-9-]{8,100}$/i.test(seasonPassCode)) {
    return jsonNoStore({ error: "ข้อมูลบัตรรายปีไม่ถูกต้อง" }, { status: 400 });
  }
  await expirePendingSeasonPassPurchases({ purchaseCode: seasonPassCode, passCode: seasonPassCode });
  const purchase = await prisma.seasonPassPurchase.findUnique({
    where: { purchaseCode: seasonPassCode },
    select: { customerId: true, customerEmail: true, status: true },
  });
  if (purchase) {
    if (!(await hasSeasonPaymentAccess(purchase))) return paymentTargetNotFound();
    return jsonNoStore({
      confirmed: purchase.status === "CONFIRMED",
      expired: purchase.status === "CANCELLED",
    });
  }
  const order = await prisma.seasonPassOrder.findFirst({
    where: { passCode: seasonPassCode, purchaseId: null },
    select: { customerId: true, customerEmail: true, status: true },
  });
  if (!order || !(await hasSeasonPaymentAccess(order))) return paymentTargetNotFound();
  return jsonNoStore({
    confirmed: order.status === "CONFIRMED",
    expired: order.status === "CANCELLED",
  });
}
