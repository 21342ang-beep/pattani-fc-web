import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const bookingCode = params.get("bookingCode")?.trim();
  const seasonPassCode = params.get("seasonPassCode")?.trim();

  if (Boolean(bookingCode) === Boolean(seasonPassCode)) {
    return Response.json({ error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, { status: 400 });
  }

  if (bookingCode) {
    if (!/^[a-z0-9]{8,50}$/i.test(bookingCode)) return Response.json({ error: "ข้อมูลการจองไม่ถูกต้อง" }, { status: 400 });
    const booking = await prisma.booking.findUnique({ where: { bookingCode }, select: { status: true } });
    if (!booking) return Response.json({ error: "ไม่พบรายการจอง" }, { status: 404 });
    return Response.json({ confirmed: booking.status === "CONFIRMED" });
  }

  if (!seasonPassCode || !/^[a-z0-9-]{8,100}$/i.test(seasonPassCode)) {
    return Response.json({ error: "ข้อมูลบัตรรายปีไม่ถูกต้อง" }, { status: 400 });
  }
  const order = await prisma.seasonPassOrder.findUnique({ where: { passCode: seasonPassCode }, select: { status: true } });
  if (!order) return Response.json({ error: "ไม่พบรายการสมัครบัตรรายปี" }, { status: 404 });
  return Response.json({ confirmed: order.status === "CONFIRMED" });
}
