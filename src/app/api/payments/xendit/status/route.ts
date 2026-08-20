import { prisma } from "@/lib/prisma";
import { jsonNoStore, paymentTargetNotFound, rateLimitedJson } from "@/lib/payment-http";
import { rateLimit } from "@/lib/rate-limit";
import { xenditLegacyPaymentsEnabled } from "@/lib/xendit";
import { hasBookingAccess } from "@/lib/booking-access";
import { hasSeasonPaymentAccess } from "@/lib/season-payment-access";

export async function GET(request: Request) {
  if (!xenditLegacyPaymentsEnabled()) {
    return jsonNoStore({ error: "ช่องทางชำระเงินเดิมถูกปิดใช้งาน" }, { status: 410 });
  }
  const rl = await rateLimit("xendit_payment_status", { max: 1_200, windowMs: 60_000 });
  if (!rl.ok) return rateLimitedJson(rl.retryAfterSec);
  const params = new URL(request.url).searchParams;
  const bookingCode = params.get("bookingCode")?.trim();
  const seasonPassCode = params.get("seasonPassCode")?.trim();

  if (Boolean(bookingCode) === Boolean(seasonPassCode)) {
    return jsonNoStore({ error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, { status: 400 });
  }

  if (bookingCode) {
    if (!/^[a-z0-9]{8,50}$/i.test(bookingCode)) return jsonNoStore({ error: "ข้อมูลการจองไม่ถูกต้อง" }, { status: 400 });
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
    return jsonNoStore({ confirmed: booking.status === "CONFIRMED" });
  }

  if (!seasonPassCode || !/^[a-z0-9-]{8,100}$/i.test(seasonPassCode)) {
    return jsonNoStore({ error: "ข้อมูลบัตรรายปีไม่ถูกต้อง" }, { status: 400 });
  }
  const purchase = await prisma.seasonPassPurchase.findUnique({
    where: { purchaseCode: seasonPassCode },
    select: { customerId: true, customerEmail: true, status: true },
  });
  if (purchase) {
    if (!(await hasSeasonPaymentAccess(purchase))) return paymentTargetNotFound();
    return jsonNoStore({ confirmed: purchase.status === "CONFIRMED" });
  }
  const order = await prisma.seasonPassOrder.findFirst({
    where: { passCode: seasonPassCode, purchaseId: null },
    select: { customerId: true, customerEmail: true, status: true },
  });
  if (!order || !(await hasSeasonPaymentAccess(order))) return paymentTargetNotFound();
  return jsonNoStore({ confirmed: order.status === "CONFIRMED" });
}
