import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const bookingCode = new URL(request.url).searchParams.get("bookingCode")?.trim();
  if (!bookingCode || !/^[a-z0-9]{8,50}$/i.test(bookingCode)) {
    return Response.json({ error: "ข้อมูลการจองไม่ถูกต้อง" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingCode },
    select: { status: true },
  });
  if (!booking) return Response.json({ error: "ไม่พบรายการจอง" }, { status: 404 });
  return Response.json({ confirmed: booking.status === "CONFIRMED" });
}
