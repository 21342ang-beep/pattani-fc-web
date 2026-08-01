"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { bookingCreateSchema } from "@/lib/validations";
import { verifyPermission } from "@/lib/dal";
import { readCustomerSession } from "@/lib/customer-session";
import { SEASON_LABEL } from "@/lib/season-pass-tiers";
import {
  matchUsesSeasonPassCapacity,
  seasonPassSeatZoneToMatchZone,
} from "@/lib/seat-availability";
import {
  getStadiumZone,
  getZoneCapacity,
  getZoneCapacityScope,
  type StadiumZoneCode,
} from "@/lib/stadium-zones";

export type BookingFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

// สาธารณะ — สร้างการจองได้ทั้ง member และ guest (ไม่ต้องสมัครสมาชิก)
// อีเมลถูกบังคับมาจาก session เท่านั้น (ไม่ trust client) → กัน spoof / abuse
// guest = customerEmail = null, ใช้ phone + bookingCode ในการตรวจสอบจองภายหลัง
export async function createBooking(
  _prev: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  // login เสริม (optional) — ถ้ามี session จะใช้อีเมลของบัญชี
  // ถ้าไม่มี session = guest booking (อีเมล null)
  const session = await readCustomerSession();

  const parsed = bookingCreateSchema.safeParse({
    matchId: formData.get("matchId"),
    zone: formData.get("zone"),
    customerName: formData.get("customerName"),
    customerEmail: session?.email ?? null, // ← session-only, ไม่อ่านจาก form
    customerPhone: formData.get("customerPhone"),
    quantity: Number(formData.get("quantity") ?? 0),
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let bookingCode: string;
  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const match = await tx.match.findUnique({ where: { id: parsed.data.matchId } });
        if (!match) throw new Error("ไม่พบแมตช์ที่ต้องการ");
        if (match.status !== "ON_SALE") throw new Error("แมตช์นี้ยังไม่เปิดจอง หรือปิดการจองแล้ว");
        // defense-in-depth — แมตช์ ON_SALE ควรมีข้อมูลครบเสมอ (validate ตอน save)
        // ถ้ามาถึงตรงนี้แล้ว field ขาด แสดงว่ามีข้อมูลผิดปกติ — refuse booking
        const zone = getStadiumZone(parsed.data.zone);
        if (!zone) {
          throw new Error("ข้อมูลแมตช์ยังไม่สมบูรณ์ ไม่สามารถจองได้");
        }

        const capacity = getZoneCapacity(match, parsed.data.zone);
        if (capacity == null) {
          throw new Error("โซนนี้ยังไม่เปิดขายสำหรับแมตช์นี้");
        }

        const capacityScope = getZoneCapacityScope(match, parsed.data.zone);
        const sold = await tx.booking.aggregate({
          where: {
            matchId: match.id,
            zone: { in: capacityScope },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          _sum: { quantity: true },
        });
        let seasonReserved = 0;
        if (matchUsesSeasonPassCapacity(match)) {
          const seasonGroups = await tx.seasonPassOrder.groupBy({
            by: ["seatZone"],
            where: {
              seasonLabel: SEASON_LABEL,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            _count: { _all: true },
          });
          seasonReserved = seasonGroups.reduce((sum, group) => {
            const code = seasonPassSeatZoneToMatchZone(group.seatZone);
            return code && capacityScope.includes(code as StadiumZoneCode)
              ? sum + group._count._all
              : sum;
          }, 0);
        }
        const remaining = Math.max(0, capacity - (sold._sum.quantity ?? 0) - seasonReserved);
        if (parsed.data.quantity > remaining) {
          throw new Error(`ที่นั่งเหลือ ${remaining} ที่ ไม่พอ`);
        }

        // ใช้ `match: { connect }` แทน `matchId` — ชัดเจน + รองรับ
        // client เวอร์ชั่นเก่าใน dev memory cache (กัน error "match is missing")
        return tx.booking.create({
          data: {
            match: { connect: { id: match.id } },
            customerName: parsed.data.customerName,
            customerEmail: parsed.data.customerEmail ?? null,
            customerPhone: parsed.data.customerPhone,
            quantity: parsed.data.quantity,
            zone: parsed.data.zone,
            totalAmount: zone.priceSatang * parsed.data.quantity,
            notes: parsed.data.notes,
          },
        });
      },
      // เพิ่ม wait ให้ทนกับ cold-compile/hot-reload ใน Turbopack dev
      // (ใน prod เร็วกว่านี้มาก ไม่กระทบประสิทธิภาพ)
      { maxWait: 10000, timeout: 15000 }
    );
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath("/matches");
    revalidatePath(`/matches/${parsed.data.matchId}`);
    // invalidate unstable_cache queries — ที่นั่งเหลือต้องอัปเดตทันที
    revalidateTag("bookings", { expire: 0 });
    bookingCode = booking.bookingCode;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }

  // ข้าม intermediate "จองสำเร็จ" — ไป checkout ทันที เพื่อไม่ให้
  // PENDING booking ค้าง แล้วกันที่นั่งของลูกค้ารายอื่น
  // (redirect throws NEXT_REDIRECT → ต้องเรียกนอก try/catch)
  redirect(
    `/checkout/${bookingCode}?phone=${encodeURIComponent(parsed.data.customerPhone)}`
  );
}

// Admin — เปลี่ยนสถานะการจอง
export async function updateBookingStatus(
  bookingId: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED"
): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("BOOKINGS");
  try {
    const booking = await prisma.booking.update({ where: { id: bookingId }, data: { status } });
    revalidatePath("/admin/bookings");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath(`/matches/${booking.matchId}`);
    revalidateTag("bookings", { expire: 0 });
    return { ok: true };
  } catch {
    return { error: "อัปเดตไม่สำเร็จ" };
  }
}

// Admin — ลบรายการจอง (หลังจบแมตช์, ทำความสะอาดข้อมูล)
// validate bookingId format → กัน inject ผ่าน params
export async function deleteBooking(
  bookingId: string
): Promise<{ ok: true } | { error: string }> {
  await verifyPermission("BOOKINGS");
  if (typeof bookingId !== "string" || !/^[a-z0-9]+$/i.test(bookingId)) {
    return { error: "รหัสไม่ถูกต้อง" };
  }
  try {
    const booking = await prisma.booking.delete({ where: { id: bookingId } });
    revalidatePath("/admin/bookings");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath(`/matches/${booking.matchId}`);
    revalidateTag("bookings", { expire: 0 });
    return { ok: true };
  } catch {
    return { error: "ลบไม่สำเร็จ" };
  }
}

// Admin — ลบข้อมูลการจองทั้งหมดสำหรับการทดสอบระบบ
export async function deleteAllBookings(): Promise<
  { ok: true; deleted: number } | { error: string }
> {
  await verifyPermission("BOOKINGS");
  try {
    const result = await prisma.booking.deleteMany();
    revalidatePath("/admin/bookings");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath("/matches");
    revalidateTag("bookings", { expire: 0 });
    return { ok: true, deleted: result.count };
  } catch {
    return { error: "ลบข้อมูลการจองไม่สำเร็จ" };
  }
}
