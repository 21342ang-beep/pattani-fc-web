import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Cache key แยกตาม filter — matches list เปลี่ยนไม่บ่อย (ข้อมูล match)
// invalidate ผ่าน revalidateTag("matches") จาก admin action ตอนแก้ match/booking
export const getMatchesByFilter = unstable_cache(
  async (filter: "all" | "on_sale" | "upcoming", competitionType?: "LEAGUE" | "CUP") => {
    const where: Prisma.MatchWhereInput =
      filter === "on_sale"
        ? { status: "ON_SALE" }
        : filter === "upcoming"
        ? { status: { in: ["SCHEDULED", "ON_SALE"] } }
        : { status: { notIn: ["CANCELLED"] } };
    return prisma.match.findMany({
      where: competitionType ? { ...where, competitionType } : where,
      orderBy: { kickoffAt: "asc" },
    });
  },
  ["matches-list"],
  { revalidate: 60, tags: ["matches"] }
);

// Match info เปลี่ยนไม่บ่อย (name, venue, price, totalSeats, status)
// ที่นั่งเหลือแยก query (แคชสั้นกว่า)
export const getMatchById = unstable_cache(
  async (id: string) => prisma.match.findUnique({ where: { id } }),
  ["match-by-id"],
  { revalidate: 30, tags: ["matches"] }
);

// จำนวนที่นั่งขายไปแล้ว — เปลี่ยนบ่อยตอนเปิดจอง แคชสั้น
// ต้อง revalidateTag(`match-sold-${matchId}`) ใน booking action ตอนจองสำเร็จ
export const getSoldSeats = unstable_cache(
  async (matchId: string) => {
    const res = await prisma.booking.aggregate({
      where: { matchId, status: { in: ["PENDING", "CONFIRMED"] } },
      _sum: { quantity: true },
    });
    return res._sum.quantity ?? 0;
  },
  ["match-sold"],
  { revalidate: 10, tags: ["bookings"] }
);
