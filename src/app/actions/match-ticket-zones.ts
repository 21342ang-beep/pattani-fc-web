"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { activeBookingStatusWhere, expirePendingBookings } from "@/lib/booking-expiry";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { STADIUM_ZONE_CODES } from "@/lib/stadium-zones";

const zoneSchema = z.object({
  code: z.string().trim().toUpperCase().regex(
    /^[A-Z0-9][A-Z0-9-]{0,19}$/,
    "รหัสโซนใช้ได้เฉพาะ A-Z, 0-9 และขีดกลาง ไม่เกิน 20 ตัว",
  ),
  name: z.string().trim().min(1, "กรุณากรอกชื่อโซน").max(80),
  capacity: z.number().int().nonnegative().max(200000),
  priceBaht: z.number().positive().max(100000),
  isActive: z.boolean(),
});

const zonesSchema = z.array(zoneSchema).max(30).superRefine((zones, context) => {
  const seen = new Set<string>();
  zones.forEach((zone, index) => {
    if (seen.has(zone.code)) {
      context.addIssue({
        code: "custom",
        path: [index, "code"],
        message: `รหัสโซน ${zone.code} ซ้ำกัน`,
      });
    }
    seen.add(zone.code);
  });
});

export type MatchTicketZoneFormState = {
  ok?: true;
  error?: string;
} | undefined;

export async function saveMatchTicketZones(
  matchId: string,
  _previous: MatchTicketZoneFormState,
  formData: FormData,
): Promise<MatchTicketZoneFormState> {
  await verifyPermission("MATCHES");
  if (!z.string().regex(/^[a-z0-9]+$/i).safeParse(matchId).success) {
    return { error: "รหัสแมตช์ไม่ถูกต้อง" };
  }

  const raw = formData.get("zones");
  if (typeof raw !== "string" || raw.length > 50000) {
    return { error: "ข้อมูลโซนไม่ถูกต้อง" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "ข้อมูลโซนไม่ถูกต้อง" };
  }
  const parsed = zonesSchema.safeParse(json);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลโซนไม่ถูกต้อง" };
  }
  const legacyCollision = parsed.data.find((zone) => (
    STADIUM_ZONE_CODES as readonly string[]
  ).includes(zone.code));
  if (legacyCollision) {
    return { error: `รหัส ${legacyCollision.code} เป็นโซนสนามหลักอยู่แล้ว กรุณาใช้รหัสอื่น เช่น VIP-A` };
  }

  await expirePendingBookings({ matchIds: [matchId] });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`match-capacity:${matchId}`}))`,
      );
      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: { id: true, ticketZones: { select: { code: true } } },
      });
      if (!match) throw new Error("MATCH_NOT_FOUND");

      const bookingGroups = await tx.booking.groupBy({
        by: ["zone"],
        where: { matchId, ...activeBookingStatusWhere() },
        _sum: { quantity: true },
      });
      const bookedByZone = new Map(
        bookingGroups.map((group) => [group.zone ?? "", group._sum.quantity ?? 0]),
      );

      for (const zone of parsed.data) {
        const booked = bookedByZone.get(zone.code) ?? 0;
        if (zone.capacity < booked) {
          throw new Error(`CAPACITY_BELOW_BOOKED:${zone.code}:${booked}`);
        }
      }

      const submittedCodes = new Set(parsed.data.map((zone) => zone.code));
      for (const existing of match.ticketZones) {
        if (submittedCodes.has(existing.code)) continue;
        const booked = bookedByZone.get(existing.code) ?? 0;
        if (booked > 0) throw new Error(`ZONE_HAS_BOOKINGS:${existing.code}:${booked}`);
      }

      await tx.matchTicketZone.deleteMany({
        where: submittedCodes.size > 0
          ? { matchId, code: { notIn: [...submittedCodes] } }
          : { matchId },
      });

      await Promise.all(parsed.data.map((zone, index) => tx.matchTicketZone.upsert({
        where: { matchId_code: { matchId, code: zone.code } },
        create: {
          matchId,
          code: zone.code,
          name: zone.name,
          capacity: zone.capacity,
          price: Math.round(zone.priceBaht * 100),
          sortOrder: index,
          isActive: zone.isActive,
        },
        update: {
          name: zone.name,
          capacity: zone.capacity,
          price: Math.round(zone.priceBaht * 100),
          sortOrder: index,
          isActive: zone.isActive,
        },
      })));
    }, { maxWait: 10000, timeout: 15000 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "MATCH_NOT_FOUND") return { error: "ไม่พบแมตช์นี้" };
      if (error.message.startsWith("CAPACITY_BELOW_BOOKED:")) {
        const [, code, booked = "0"] = error.message.split(":");
        return { error: `โซน ${code} มีการจองที่ยังใช้งานอยู่ ${Number(booked).toLocaleString("th-TH")} ที่ จึงลดจำนวนต่ำกว่านี้ไม่ได้` };
      }
      if (error.message.startsWith("ZONE_HAS_BOOKINGS:")) {
        const [, code, booked = "0"] = error.message.split(":");
        return { error: `ลบโซน ${code} ไม่ได้ เพราะมีการจองที่ยังใช้งานอยู่ ${Number(booked).toLocaleString("th-TH")} ที่` };
      }
    }
    return { error: "บันทึกโซนขายรายแมตช์ไม่สำเร็จ" };
  }

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/matches");
  revalidatePath("/admin/bookings/staff");
  revalidatePath("/tickets");
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidateTag("matches", { expire: 0 });
  return { ok: true };
}
