// gen เลขที่นั่งแบบสุ่มไม่ซ้ำในแมตช์เดียวกัน
// รูปแบบ: <โซน>-<หมายเลข> เช่น A-101, B-204
//
// ใช้ตอน confirmPayment เพื่อออกที่นั่งให้การจอง

import { prisma } from "@/lib/prisma";

const ZONES = ["A", "B", "C", "D"];

export async function allocateSeats(matchId: string, quantity: number): Promise<string[]> {
  // รวมที่นั่งที่ออกไปแล้วในแมตช์นี้ (จาก booking ที่ CONFIRMED แล้ว)
  const taken = await prisma.booking.findMany({
    where: { matchId, status: "CONFIRMED" },
    select: { seatNumbers: true },
  });
  const usedSet = new Set<string>();
  for (const b of taken) {
    for (const s of b.seatNumbers) usedSet.add(s);
  }

  const out: string[] = [];
  let attempts = 0;
  while (out.length < quantity && attempts < quantity * 50) {
    const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
    const num = 100 + Math.floor(Math.random() * 900); // 100-999
    const seat = `${zone}-${num}`;
    if (!usedSet.has(seat) && !out.includes(seat)) {
      out.push(seat);
    }
    attempts++;
  }
  // fallback ถ้าหาไม่พอ (ไม่น่าจะเกิดในสนามเล็ก)
  while (out.length < quantity) {
    out.push(`X-${Date.now()}-${out.length}`);
  }
  return out;
}
