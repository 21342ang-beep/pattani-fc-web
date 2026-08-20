"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  resolveSeasonPassGateCredential,
  seasonPassGateCredentialMatchesRow,
} from "@/lib/season-pass-gate-token";
import {
  GATE_LOCAL_SCAN_ID_PATTERN,
  isGateScanTimestampAcceptable,
  planGateAdmissionSync,
} from "@/lib/gate-sync-policy";
import { verifyPermission, verifySuperAdmin } from "@/lib/dal";
import {
  isSeasonPassEligibleMatch,
  seasonPassScanConsumesLeagueUse,
} from "@/lib/season-pass-home-match";

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
  await verifyPermission("GATE_CHECK");

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
  scannedCount: number;
  scannedAt: string | null;
};

export type DownloadWhitelistResult =
  | { ok: true; matchId: string; entries: WhitelistEntry[]; generatedAt: string }
  | { ok: false; error: string };

export async function downloadWhitelist(
  rawMatchId: string
): Promise<DownloadWhitelistResult> {
  await verifyPermission("GATE_CHECK");

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
      _count: { select: { gateScans: true } },
      gateScans: {
        orderBy: { scannedAt: "desc" },
        take: 1,
        select: { scannedAt: true },
      },
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
      scannedCount: Math.min(b.quantity, b._count.gateScans),
      scannedAt:
        b.gateScans[0]?.scannedAt.toISOString() ??
        b.scannedAt?.toISOString() ??
        null,
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
        scanId: z.string().regex(GATE_LOCAL_SCAN_ID_PATTERN),
        bookingCode: z
          .string()
          .min(8)
          .max(50)
          .regex(/^[a-z0-9]+$/i),
        admissionNumber: z.number().int().positive().max(1_000_000),
        scannedAt: z.string().datetime(),
      })
    )
    .min(1)
    .max(500),
});

export type SyncScansResult =
  | {
      ok: true;
      accepted: string[];
      duplicates: string[];
      conflicts: {
        scanId: string;
        bookingCode: string;
        serverScannedAt: string | null;
      }[];
      unknown: string[];
      bookingStates: {
        bookingCode: string;
        scannedCount: number;
        latestScannedAt: string | null;
      }[];
    }
  | { ok: false; error: string };

export async function syncScans(input: unknown): Promise<SyncScansResult> {
  const currentUser = await verifyPermission("GATE_CHECK");

  const parsed = syncBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูล sync ไม่ถูกต้อง" };

  const { matchId, records } = parsed.data;
  const now = new Date();
  if (
    records.some(
      (record) =>
        !isGateScanTimestampAcceptable(new Date(record.scannedAt), now),
    )
  ) {
    return { ok: false, error: "เวลา scan ไม่ถูกต้องหรือข้อมูล offline หมดอายุแล้ว" };
  }

  // A local scan id is an idempotency key. A duplicated HTTP payload can
  // therefore never consume two admission slots.
  const uniqueByScanId = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (!uniqueByScanId.has(record.scanId)) {
      uniqueByScanId.set(record.scanId, record);
    }
  }
  const uniqueRecords = [...uniqueByScanId.values()];

  // โหลด booking ที่เกี่ยวข้องครั้งเดียว → ลด round-trip
  const existing = await prisma.booking.findMany({
    where: {
      matchId,
      bookingCode: { in: uniqueRecords.map((r) => r.bookingCode) },
      status: "CONFIRMED",
    },
    select: { id: true, bookingCode: true },
  });
  const existingMap = new Map(
    existing.map((booking) => [booking.bookingCode, booking]),
  );

  const accepted: string[] = [];
  const duplicates: string[] = [];
  const conflicts: {
    scanId: string;
    bookingCode: string;
    serverScannedAt: string | null;
  }[] = [];
  const unknown: string[] = [];
  const bookingStates: {
    bookingCode: string;
    scannedCount: number;
    latestScannedAt: string | null;
  }[] = [];
  const grouped = new Map<string, (typeof uniqueRecords)[number][]>();

  for (const record of uniqueRecords) {
    const booking = existingMap.get(record.bookingCode);
    if (!booking) {
      unknown.push(record.scanId);
      continue;
    }
    const group = grouped.get(booking.id) ?? [];
    group.push(record);
    grouped.set(booking.id, group);
  }

  // Lock booking rows in a deterministic order. The row update serializes two
  // gates that reconnect together, so count + insert is one atomic quota use.
  await prisma.$transaction(async (tx) => {
    for (const bookingId of [...grouped.keys()].sort()) {
      const group = grouped.get(bookingId) ?? [];
      const lock = await tx.booking.updateMany({
        where: { id: bookingId },
        data: { updatedAt: now },
      });
      if (lock.count !== 1) {
        unknown.push(...group.map((record) => record.scanId));
        continue;
      }

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          bookingCode: true,
          matchId: true,
          status: true,
          quantity: true,
          scannedAt: true,
        },
      });
      if (!booking || booking.matchId !== matchId || booking.status !== "CONFIRMED") {
        unknown.push(...group.map((record) => record.scanId));
        continue;
      }

      const existingCount = await tx.bookingGateScan.count({
        where: { bookingId: booking.id },
      });
      const plan = planGateAdmissionSync(
        booking.quantity,
        existingCount,
        group.map((record) => ({
          scanId: record.scanId,
          admissionNumber: record.admissionNumber,
        })),
      );
      const acceptedSet = new Set(plan.accepted);
      const acceptedRecords = group
        .filter((record) => acceptedSet.has(record.scanId))
        .sort(
          (a, b) =>
            a.admissionNumber - b.admissionNumber ||
            a.scanId.localeCompare(b.scanId),
        );

      for (const record of acceptedRecords) {
        await tx.bookingGateScan.create({
          data: {
            bookingId: booking.id,
            scannedAt: new Date(record.scannedAt),
            scannedBy: currentUser.id,
          },
        });
      }
      if (acceptedRecords.length > 0 && !booking.scannedAt) {
        await tx.booking.updateMany({
          where: { id: booking.id, scannedAt: null },
          data: {
            scannedAt: new Date(acceptedRecords[0].scannedAt),
            scannedBy: currentUser.id,
          },
        });
      }

      const latest = await tx.bookingGateScan.findFirst({
        where: { bookingId: booking.id },
        orderBy: { scannedAt: "desc" },
        select: { scannedAt: true },
      });
      const latestScannedAt = latest?.scannedAt.toISOString() ?? null;
      accepted.push(...plan.accepted);
      duplicates.push(...plan.duplicates);
      conflicts.push(
        ...plan.conflicts.map((scanId) => ({
          scanId,
          bookingCode: booking.bookingCode,
          serverScannedAt: latestScannedAt,
        })),
      );
      bookingStates.push({
        bookingCode: booking.bookingCode,
        scannedCount: plan.finalCount,
        latestScannedAt,
      });
    }
  });

  if (accepted.length > 0) {
    revalidatePath("/admin/bookings");
    revalidatePath("/gate-check");
  }
  return {
    ok: true,
    accepted,
    duplicates,
    conflicts,
    unknown,
    bookingStates,
  };
}

const seasonPassScanSchema = z.object({
  matchId: z.string().min(1).max(50),
  barcode: z.string().trim().min(1).max(256),
});

type SeasonPassScanError = "NOT_FOUND" | "DUPLICATE" | "EXHAUSTED" | "INACTIVE" | "UNREGISTERED" | "INVALID" | "MATCH_NOT_ELIGIBLE";

export type LookupSeasonPassResult =
  | {
      ok: true;
      barcode: string;
      scanCredential: string;
      passCode: string;
      customerName: string;
      customerPhoneLast4: string;
      seatZone: string;
      tierId: string;
      usesRemaining: number;
      competitionType: "LEAGUE" | "CUP";
    }
  | { ok: false; error: SeasonPassScanError };

export type ScanSeasonPassResult =
  | {
      ok: true;
      passCode: string;
      customerName: string;
      customerPhoneLast4: string;
      customerEmail: string | null;
      seatZone: string;
      tierId: string;
      usesRemaining: number;
      scanId: string;
      competitionType: "LEAGUE" | "CUP";
    }
  | { ok: false; error: SeasonPassScanError };

function phoneLast4(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 4 ? digits.slice(-4) : "—";
}

// Read-only preview for gate staff. No usage is consumed until scanSeasonPass
// is called from the explicit confirmation step.
export async function lookupSeasonPass(input: unknown): Promise<LookupSeasonPassResult> {
  await verifyPermission("GATE_CHECK");
  const parsed = seasonPassScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID" };

  const credential = resolveSeasonPassGateCredential(parsed.data.barcode);
  if (!credential) return { ok: false, error: "INVALID" };
  const match = await prisma.match.findUnique({
    where: { id: parsed.data.matchId },
    select: { competitionType: true, homeTeam: true, seasonPassEligible: true },
  });
  if (!match || !isSeasonPassEligibleMatch(match)) {
    return { ok: false, error: "MATCH_NOT_ELIGIBLE" };
  }

  const pass = await prisma.seasonPassBarcode.findUnique({
    // SPG2 is an opaque capability: only its unique nonce may locate a row.
    // Never fall back to the visible sequential barcode for a current token.
    where:
      credential.kind === "current"
        ? { gateNonce: credential.gateNonce }
        : { barcode: credential.barcode },
    include: {
      order: {
        select: {
          status: true,
          passCode: true,
          customerName: true,
          customerPhone: true,
          seatZone: true,
        },
      },
      scans: {
        where: { matchId: parsed.data.matchId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!pass) return { ok: false, error: "NOT_FOUND" };
  if (!seasonPassGateCredentialMatchesRow(credential, pass)) {
    return { ok: false, error: "INVALID" };
  }

  const order = pass.order;
  if (pass.tierId === "vvip-elite" && pass.isGenerated && !order) {
    return { ok: false, error: "UNREGISTERED" };
  }
  if (!order || order.status !== "CONFIRMED") {
    return { ok: false, error: "INACTIVE" };
  }
  if (pass.scans.length > 0) return { ok: false, error: "DUPLICATE" };
  if (seasonPassScanConsumesLeagueUse(match.competitionType) && pass.usesRemaining <= 0) {
    return { ok: false, error: "EXHAUSTED" };
  }

  return {
    ok: true,
    barcode: pass.barcode,
    scanCredential: parsed.data.barcode,
    passCode: order.passCode,
    customerName: order.customerName,
    customerPhoneLast4: phoneLast4(order.customerPhone),
    seatZone: order.seatZone,
    tierId: pass.tierId,
    usesRemaining: pass.usesRemaining,
    competitionType: match.competitionType,
  };
}

// Season passes require an online, transactional check: this is what makes a
// duplicate scan fail immediately even when two gates scan at the same time.
export async function scanSeasonPass(input: unknown): Promise<ScanSeasonPassResult> {
  const user = await verifyPermission("GATE_CHECK");
  const parsed = seasonPassScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID" };

  const { matchId } = parsed.data;
  const credential = resolveSeasonPassGateCredential(parsed.data.barcode);
  if (!credential) return { ok: false, error: "INVALID" };
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { competitionType: true, homeTeam: true, seasonPassEligible: true },
  });
  if (!match || !isSeasonPassEligibleMatch(match)) {
    return { ok: false, error: "MATCH_NOT_ELIGIBLE" };
  }
  const pass = await prisma.seasonPassBarcode.findUnique({
    where:
      credential.kind === "current"
        ? { gateNonce: credential.gateNonce }
        : { barcode: credential.barcode },
    include: {
      order: {
        select: {
          status: true,
          passCode: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          seatZone: true,
        },
      },
    },
  });
  if (!pass) return { ok: false, error: "NOT_FOUND" };
  if (!seasonPassGateCredentialMatchesRow(credential, pass)) {
    return { ok: false, error: "INVALID" };
  }
  const order = pass.order;
  if (pass.tierId === "vvip-elite" && pass.isGenerated && !order) {
    return { ok: false, error: "UNREGISTERED" };
  }
  if (!order || order.status !== "CONFIRMED") {
    return { ok: false, error: "INACTIVE" };
  }
  const consumesLeagueUse = seasonPassScanConsumesLeagueUse(match.competitionType);
  if (consumesLeagueUse && pass.usesRemaining <= 0) return { ok: false, error: "EXHAUSTED" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "SeasonPassBarcode"
        WHERE "id" = ${pass.id}
        FOR UPDATE
      `;
      const currentPass = await tx.seasonPassBarcode.findUnique({
        where: { id: pass.id },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              passCode: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              seatZone: true,
            },
          },
        },
      });
      if (!currentPass) throw new Error("NOT_FOUND");
      if (!seasonPassGateCredentialMatchesRow(credential, currentPass)) {
        throw new Error("INVALID_CREDENTIAL");
      }
      if (currentPass.tierId === "vvip-elite" && currentPass.isGenerated && !currentPass.order) {
        throw new Error("UNREGISTERED");
      }
      if (!currentPass.order || currentPass.order.status !== "CONFIRMED") {
        throw new Error("INACTIVE");
      }
      if (consumesLeagueUse && currentPass.usesRemaining <= 0) {
        throw new Error("EXHAUSTED");
      }

      if (consumesLeagueUse) {
        const consumed = await tx.seasonPassBarcode.updateMany({
          where: {
            id: currentPass.id,
            orderId: currentPass.order.id,
            usesRemaining: { gt: 0 },
          },
          data: { usesRemaining: { decrement: 1 } },
        });
        if (consumed.count !== 1) throw new Error("EXHAUSTED");
      }
      const scan = await tx.seasonPassScan.create({
        data: { barcodeId: currentPass.id, matchId, scannedBy: user.id },
        select: { id: true, barcode: { select: { usesRemaining: true } } },
      });
      return {
        usesRemaining: scan.barcode.usesRemaining,
        scanId: scan.id,
        passCode: currentPass.order.passCode,
        customerName: currentPass.order.customerName,
        customerPhone: currentPass.order.customerPhone,
        customerEmail: currentPass.order.customerEmail,
        seatZone: currentPass.order.seatZone,
        tierId: currentPass.tierId,
      };
    });
    return {
      ok: true,
      passCode: result.passCode,
      customerName: result.customerName,
      customerPhoneLast4: phoneLast4(result.customerPhone),
      customerEmail: result.customerEmail,
      seatZone: result.seatZone,
      tierId: result.tierId,
      usesRemaining: result.usesRemaining,
      scanId: result.scanId,
      competitionType: match.competitionType,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "EXHAUSTED") return { ok: false, error: "EXHAUSTED" };
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    if (error instanceof Error && error.message === "UNREGISTERED") return { ok: false, error: "UNREGISTERED" };
    if (error instanceof Error && error.message === "INACTIVE") return { ok: false, error: "INACTIVE" };
    if (error instanceof Error && error.message === "INVALID_CREDENTIAL") return { ok: false, error: "INVALID" };
    // PostgreSQL unique index [barcodeId, matchId] is the final duplicate guard.
    return { ok: false, error: "DUPLICATE" };
  }
}

// ใช้สำหรับล้างรายการทดสอบจากหน้าผู้ดูแลบัตรรายปีเท่านั้น
// เมื่อลบ scan จะคืนสิทธิ์เฉพาะรายการบอลลีก บอลถ้วยไม่เคยหักสิทธิ์จึงไม่คืนเพิ่ม
export async function deleteSeasonPassScan(scanId: string): Promise<{ ok: true } | { error: string }> {
  await verifySuperAdmin();
  if (!z.string().regex(/^[a-z0-9]+$/i).safeParse(scanId).success) {
    return { error: "รหัสรายการสแกนไม่ถูกต้อง" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const scan = await tx.seasonPassScan.findUnique({
        where: { id: scanId },
        select: { id: true, barcodeId: true, match: { select: { competitionType: true } } },
      });
      if (!scan) throw new Error("NOT_FOUND");
      await tx.seasonPassScan.delete({ where: { id: scan.id } });
      if (seasonPassScanConsumesLeagueUse(scan.match.competitionType)) {
        await tx.seasonPassBarcode.update({
          where: { id: scan.barcodeId },
          data: { usesRemaining: { increment: 1 } },
        });
      }
    });
    revalidatePath("/admin/season-passes/check");
    return { ok: true };
  } catch {
    return { error: "ลบข้อมูลการสแกนไม่สำเร็จ" };
  }
}

export async function deleteAllSeasonPassScans(): Promise<{ ok: true; deleted: number } | { error: string }> {
  await verifySuperAdmin();
  if (process.env.NODE_ENV === "production") {
    return { error: "ปิดการล้างประวัติสแกนทั้งหมดบนระบบจริง" };
  }

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const scans = await tx.seasonPassScan.findMany({
        select: { id: true, barcodeId: true, match: { select: { competitionType: true } } },
      });
      if (scans.length === 0) return 0;

      const scanIds = scans.map((scan) => scan.id);
      const restoredUses = new Map<string, number>();
      for (const scan of scans) {
        if (!seasonPassScanConsumesLeagueUse(scan.match.competitionType)) continue;
        restoredUses.set(scan.barcodeId, (restoredUses.get(scan.barcodeId) ?? 0) + 1);
      }

      await tx.seasonPassScan.deleteMany({ where: { id: { in: scanIds } } });
      await Promise.all(
        [...restoredUses.entries()].map(([barcodeId, uses]) =>
          tx.seasonPassBarcode.update({ where: { id: barcodeId }, data: { usesRemaining: { increment: uses } } }),
        ),
      );
      return scans.length;
    });
    revalidatePath("/admin/season-passes/check");
    return { ok: true, deleted };
  } catch {
    return { error: "ลบข้อมูลการสแกนทั้งหมดไม่สำเร็จ" };
  }
}

export async function deleteSeasonPassScansByTier(tierId: string): Promise<{ ok: true; deleted: number } | { error: string }> {
  await verifySuperAdmin();
  if (process.env.NODE_ENV === "production") {
    return { error: "ปิดการล้างประวัติสแกนเป็นชุดบนระบบจริง" };
  }
  if (!z.enum(["vvip-elite", "vip-advanced", "premium", "gold"]).safeParse(tierId).success) {
    return { error: "แพ็กเกจบัตรไม่ถูกต้อง" };
  }

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const scans = await tx.seasonPassScan.findMany({
        where: { barcode: { tierId } },
        select: { id: true, barcodeId: true, match: { select: { competitionType: true } } },
      });
      if (scans.length === 0) return 0;

      const scanIds = scans.map((scan) => scan.id);
      const restoredUses = new Map<string, number>();
      for (const scan of scans) {
        if (!seasonPassScanConsumesLeagueUse(scan.match.competitionType)) continue;
        restoredUses.set(scan.barcodeId, (restoredUses.get(scan.barcodeId) ?? 0) + 1);
      }

      await tx.seasonPassScan.deleteMany({ where: { id: { in: scanIds } } });
      await Promise.all(
        [...restoredUses.entries()].map(([barcodeId, uses]) =>
          tx.seasonPassBarcode.update({ where: { id: barcodeId }, data: { usesRemaining: { increment: uses } } }),
        ),
      );
      return scans.length;
    });
    revalidatePath("/admin/season-passes/check");
    return { ok: true, deleted };
  } catch {
    return { error: "ลบข้อมูลการสแกนของแพ็กเกจไม่สำเร็จ" };
  }
}
