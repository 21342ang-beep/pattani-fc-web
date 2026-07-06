"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";

// Server actions สำหรับหน้า /gate-check (ระบบสแกนเข้างานที่ประตูสนาม)
// ทุก action ต้องผ่าน verifyAdmin → ป้องกันคนนอกใช้
//
// Flow:
// 1) admin เปิด /gate-check ตอนยังมีเน็ต → listGateMatches() เลือกแมตช์
// 2) downloadWhitelist(matchId) → เก็บลง IndexedDB
// 3) ยิงบาร์โค้ดที่ประตู → ตรวจ offline ใน IndexedDB
// 4) เมื่อกลับมามีเน็ต → syncScans() ส่ง batch ขึ้น server

// ─── 1) list แมตช์ที่จะคุมประตู ─────────────────────────────────
// แสดงเฉพาะแมตช์ ON_SALE / SCHEDULED ที่ kickoff ยังไม่ผ่านนานเกิน 1 วัน
export async function listGateMatches() {
  await verifyAdmin();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ["ON_SALE", "SCHEDULED", "SOLD_OUT"] },
      OR: [{ kickoffAt: null }, { kickoffAt: { gte: since } }],
    },
    orderBy: [{ kickoffAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      venue: true,
      kickoffAt: true,
      status: true,
      _count: {
        select: {
          bookings: { where: { status: "CONFIRMED" } },
        },
      },
    },
    take: 50,
  });

  return matches.map((m) => ({
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    venue: m.venue,
    kickoffAt: m.kickoffAt?.toISOString() ?? null,
    status: m.status,
    confirmedCount: m._count.bookings,
  }));
}

// ─── 2) ดาวน์โหลด whitelist ของแมตช์ ─────────────────────────
// คืน CONFIRMED bookings เฉพาะ field ที่จำเป็นต่อการสแกน
// ตัด PII ที่ไม่จำเป็น (email, ยอดเงิน) — เก็บแค่ชื่อ + ที่นั่ง + scannedAt
const matchIdSchema = z.string().min(1).max(50);

export type WhitelistEntry = {
  bookingCode: string;
  customerName: string;
  quantity: number;
  seatNumbers: string[];
  scannedAt: string | null;
};

export type DownloadWhitelistResult =
  | { ok: true; matchId: string; entries: WhitelistEntry[]; generatedAt: string }
  | { ok: false; error: string };

export async function downloadWhitelist(
  rawMatchId: string
): Promise<DownloadWhitelistResult> {
  await verifyAdmin();

  const parsed = matchIdSchema.safeParse(rawMatchId);
  if (!parsed.success) return { ok: false, error: "matchId ไม่ถูกต้อง" };

  const match = await prisma.match.findUnique({
    where: { id: parsed.data },
    select: { id: true },
  });
  if (!match) return { ok: false, error: "ไม่พบแมตช์" };

  const bookings = await prisma.booking.findMany({
    where: { matchId: parsed.data, status: "CONFIRMED" },
    select: {
      bookingCode: true,
      customerName: true,
      quantity: true,
      seatNumbers: true,
      scannedAt: true,
    },
  });

  return {
    ok: true,
    matchId: parsed.data,
    entries: bookings.map((b) => ({
      bookingCode: b.bookingCode,
      customerName: b.customerName,
      quantity: b.quantity,
      seatNumbers: b.seatNumbers,
      scannedAt: b.scannedAt?.toISOString() ?? null,
    })),
    generatedAt: new Date().toISOString(),
  };
}

// ─── 3) sync scan กลับ server ────────────────────────────────
// รับ batch ของ {bookingCode, scannedAt}
// ใช้ "first-write-wins" — ถ้า scannedAt บน server มีอยู่แล้ว ไม่เขียนทับ
// (กันกรณีสแกนซ้ำข้ามเครื่อง — ครั้งแรกที่ขึ้น server ถือว่าใช้แล้ว)
const syncBatchSchema = z.object({
  matchId: z.string().min(1).max(50),
  records: z
    .array(
      z.object({
        bookingCode: z
          .string()
          .min(8)
          .max(50)
          .regex(/^[a-z0-9]+$/i),
        scannedAt: z.string().datetime(),
      })
    )
    .min(1)
    .max(500),
});

export type SyncScansResult =
  | {
      ok: true;
      accepted: string[]; // bookingCodes ที่ server ยอมรับ (ครั้งแรกที่ scan)
      conflicts: { bookingCode: string; serverScannedAt: string }[]; // ถูกสแกนซ้ำที่อื่นแล้ว
      unknown: string[]; // ไม่พบใน DB หรือไม่ใช่ของแมตช์นี้
    }
  | { ok: false; error: string };

export async function syncScans(input: unknown): Promise<SyncScansResult> {
  const session = await verifyAdmin();

  const parsed = syncBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูล sync ไม่ถูกต้อง" };

  const { matchId, records } = parsed.data;

  // โหลด booking ที่เกี่ยวข้องครั้งเดียว → ลด round-trip
  const existing = await prisma.booking.findMany({
    where: {
      matchId,
      bookingCode: { in: records.map((r) => r.bookingCode) },
      status: "CONFIRMED",
    },
    select: { bookingCode: true, scannedAt: true },
  });
  const existingMap = new Map(existing.map((b) => [b.bookingCode, b]));

  const accepted: string[] = [];
  const conflicts: { bookingCode: string; serverScannedAt: string }[] = [];
  const unknown: string[] = [];
  const toWrite: { bookingCode: string; scannedAt: Date }[] = [];

  for (const r of records) {
    const found = existingMap.get(r.bookingCode);
    if (!found) {
      unknown.push(r.bookingCode);
      continue;
    }
    if (found.scannedAt) {
      conflicts.push({
        bookingCode: r.bookingCode,
        serverScannedAt: found.scannedAt.toISOString(),
      });
      continue;
    }
    toWrite.push({ bookingCode: r.bookingCode, scannedAt: new Date(r.scannedAt) });
    accepted.push(r.bookingCode);
  }

  if (toWrite.length > 0) {
    // อัปเดตเฉพาะที่ยังไม่ scannedAt (race-safe — ใช้ where ห้าม scannedAt ที่ไม่ใช่ null)
    await prisma.$transaction(
      toWrite.map((w) =>
        prisma.booking.updateMany({
          where: {
            bookingCode: w.bookingCode,
            matchId,
            status: "CONFIRMED",
            scannedAt: null,
          },
          data: {
            scannedAt: w.scannedAt,
            scannedBy: session.userId,
          },
        })
      )
    );
  }

  return { ok: true, accepted, conflicts, unknown };
}
