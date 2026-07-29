import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function isValidToken(received: string | null) {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: Request) {
  if (!isValidToken(request.headers.get("x-callback-token"))) {
    return new Response("Invalid callback token", { status: 401 });
  }

  let payload: {
    event?: string;
    data?: { payment_request_id?: string; payment_id?: string; reference_id?: string };
  };
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  if (!payload.data?.payment_request_id) return Response.json({ ok: true });

  const payments = await prisma.$queryRaw<Array<{ id: string; bookingId: string; referenceId: string; amount: number; bookingCode: string }>>(
    Prisma.sql`SELECT xp."id", xp."bookingId", xp."referenceId", xp."amount", b."bookingCode"
      FROM "XenditPayment" xp INNER JOIN "Booking" b ON b."id" = xp."bookingId"
      WHERE xp."paymentRequestId" = ${payload.data.payment_request_id} LIMIT 1`
  );
  const payment = payments[0];
  if (!payment || payload.data.reference_id !== payment.referenceId) {
    return Response.json({ ok: true });
  }

  if (payload.event === "payment.capture") {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`UPDATE "XenditPayment"
        SET "status" = 'SUCCEEDED', "paymentId" = COALESCE(${payload.data?.payment_id ?? null}, "paymentId"), "updatedAt" = NOW()
        WHERE "id" = ${payment.id}`);
      await tx.booking.updateMany({
        where: { id: payment.bookingId, status: "PENDING", totalAmount: payment.amount },
        data: {
          status: "CONFIRMED",
          paymentMethod: "XENDIT_PROMPTPAY",
          paidAt: new Date(),
          seatNumbers: [],
        },
      });
    });
    revalidatePath(`/tickets/${payment.bookingCode}`);
    revalidatePath(`/checkout/${payment.bookingCode}`);
  } else if (payload.event === "payment.failure") {
    await prisma.$executeRaw(Prisma.sql`UPDATE "XenditPayment"
      SET "status" = 'FAILED', "paymentId" = COALESCE(${payload.data.payment_id ?? null}, "paymentId"), "updatedAt" = NOW()
      WHERE "id" = ${payment.id}`);
  }

  return Response.json({ ok: true });
}
