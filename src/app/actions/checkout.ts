"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ระบบรองรับ PromptPay QR เท่านั้น → fix ที่ server ไม่รับ method จาก client
// กันการปลอม "ฉันจ่ายด้วยบัตร" จาก form ที่ client ปลอมได้
const PAYMENT_METHOD = "PROMPTPAY" as const;

// ใช้เบอร์โทรเป็น identifier (universal — guest + member มีหมด)
const confirmSchema = z.object({
  bookingCode: z
    .string()
    .trim()
    .min(8)
    .max(50)
    .regex(/^[a-z0-9]+$/i),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/),
});

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

export type ConfirmPaymentState =
  | { error?: string; redirectTo?: undefined }
  | { error?: undefined; redirectTo: string }
  | undefined;

/**
 * เรียกจากปุ่ม "ฉันชำระแล้ว" หรือ "ชำระเงิน" ในแต่ละ payment method
 *
 * ในโปรดักชัน ฟังก์ชันนี้ควรถูกเรียกจาก webhook ของ payment gateway
 * (เช่น Omise charge.complete, KBANK PromptPay verify endpoint)
 * ไม่ใช่จาก client โดยตรง — ที่นี่เป็น dev/demo flow
 */
export async function confirmPayment(
  _prev: ConfirmPaymentState,
  formData: FormData
): Promise<ConfirmPaymentState> {
  const parsed = confirmSchema.safeParse({
    bookingCode: formData.get("bookingCode"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const b = await tx.booking.findUnique({
          where: { bookingCode: parsed.data.bookingCode },
          select: {
            id: true,
            matchId: true,
            status: true,
            quantity: true,
            customerPhone: true,
          },
        });
        if (
          !b ||
          normalizePhone(b.customerPhone) !== normalizePhone(parsed.data.phone)
        ) {
          throw new Error("ไม่พบการจองที่ตรงกับข้อมูลที่ระบุ");
        }
        if (b.status === "CONFIRMED") {
          return;
        }
        if (b.status !== "PENDING") {
          throw new Error("สถานะการจองไม่อนุญาตให้ชำระเงิน");
        }

        await tx.booking.update({
          where: { id: b.id },
          data: {
            status: "CONFIRMED",
            paymentMethod: PAYMENT_METHOD,
            paidAt: new Date(),
            // ยังไม่มีผังจัดสรรที่นั่ง จึงไม่สุ่มเลขที่นั่งให้ลูกค้า
            seatNumbers: [],
          },
        });
      },
      { maxWait: 10000, timeout: 15000 }
    );

    revalidatePath(`/checkout/${parsed.data.bookingCode}`);
    revalidatePath(`/tickets/${parsed.data.bookingCode}`);
    return {
      redirectTo: `/tickets/${parsed.data.bookingCode}?phone=${encodeURIComponent(parsed.data.phone)}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ชำระเงินไม่สำเร็จ" };
  }
}
