import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPromptPayPaymentRequest } from "@/lib/xendit";

const bodySchema = z.object({
  bookingCode: z.string().trim().min(8).max(50).regex(/^[a-z0-9]+$/i),
});

async function toQrSvg(qrString: string) {
  return QRCode.toString(qrString, {
    type: "svg",
    margin: 1,
    width: 320,
    color: { dark: "#052e1b", light: "#ffffff" },
  });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ข้อมูลการจองไม่ถูกต้อง" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { bookingCode: parsed.data.bookingCode },
    select: { id: true, bookingCode: true, totalAmount: true, status: true },
  });
  if (!booking) return Response.json({ error: "ไม่พบรายการจอง" }, { status: 404 });
  if (booking.status !== "PENDING") {
    return Response.json({ error: "รายการนี้ไม่สามารถชำระเงินได้" }, { status: 409 });
  }

  const existing = await prisma.$queryRaw<Array<{ paymentRequestId: string; qrString: string | null }>>(
    Prisma.sql`SELECT "paymentRequestId", "qrString" FROM "XenditPayment"
      WHERE "bookingId" = ${booking.id} AND "status" = 'PENDING' AND "qrString" IS NOT NULL
      ORDER BY "createdAt" DESC LIMIT 1`
  );
  if (existing[0]?.qrString) {
    return Response.json({ paymentRequestId: existing[0].paymentRequestId, qrSvg: await toQrSvg(existing[0].qrString) });
  }

  try {
    const created = await createPromptPayPaymentRequest({
      referenceId: `booking_${booking.bookingCode}`,
      amountBaht: booking.totalAmount / 100,
      description: `Pattani FC ticket ${booking.bookingCode}`,
    });
    await prisma.$executeRaw(Prisma.sql`INSERT INTO "XenditPayment"
      ("id", "bookingId", "referenceId", "paymentRequestId", "amount", "status", "qrString", "updatedAt")
      VALUES (${randomUUID()}, ${booking.id}, ${`booking_${booking.bookingCode}`}, ${created.paymentRequestId}, ${booking.totalAmount}, 'PENDING', ${created.qrString}, NOW())`);
    return Response.json({ paymentRequestId: created.paymentRequestId, qrSvg: await toQrSvg(created.qrString) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      const concurrent = await prisma.$queryRaw<Array<{ paymentRequestId: string; qrString: string | null }>>(
        Prisma.sql`SELECT "paymentRequestId", "qrString" FROM "XenditPayment"
          WHERE "bookingId" = ${booking.id} AND "status" = 'PENDING' AND "qrString" IS NOT NULL
          ORDER BY "createdAt" DESC LIMIT 1`
      );
      if (concurrent[0]?.qrString) {
        return Response.json({ paymentRequestId: concurrent[0].paymentRequestId, qrSvg: await toQrSvg(concurrent[0].qrString) });
      }
    }
    console.error("Unable to create Xendit payment", error);
    return Response.json({ error: "ไม่สามารถสร้าง QR ชำระเงินได้ กรุณาลองใหม่" }, { status: 502 });
  }
}
