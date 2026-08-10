"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const memberDrawSchema = z.object({
  excludedIds: z.array(z.string().min(1).max(50)).max(500),
});

export type MemberDrawWinner = {
  id: string;
  name: string;
  phoneLast4: string;
  phoneVerified: boolean;
  province: string | null;
  registeredAt: string;
};

export type MemberDrawCandidate = {
  id: string;
  name: string;
};

export type MemberDrawResult =
  | {
      ok: true;
      winners: MemberDrawWinner[];
      animationCandidates: MemberDrawCandidate[];
      remainingEligible: number;
    }
  | { ok: false; error: string };

function phoneLast4(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 4 ? digits.slice(-4) : "—";
}

export async function drawMemberWinners(input: unknown): Promise<MemberDrawResult> {
  await verifyPermission("MEMBER_DATA");

  const parsed = memberDrawSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "ข้อมูลการสุ่มไม่ถูกต้อง กรุณาลองใหม่" };
  }

  const { excludedIds } = parsed.data;
  const members = await prisma.customer.findMany({
    where: {
      ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      phoneVerifiedAt: true,
      province: true,
      createdAt: true,
    },
  });

  if (members.length === 0) {
    return { ok: false, error: "ไม่มีสมาชิกเหลืออยู่ในกลุ่มที่เลือกสำหรับการสุ่มรอบนี้" };
  }

  const winner = members[randomInt(0, members.length)];
  const animationPool = members.filter((member) => member.id !== winner.id);
  for (let index = animationPool.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [animationPool[index], animationPool[swapIndex]] = [
      animationPool[swapIndex],
      animationPool[index],
    ];
  }
  const animationCandidates: MemberDrawCandidate[] = [
    { id: winner.id, name: winner.name },
    ...animationPool.slice(0, 7).map((member) => ({
      id: member.id,
      name: member.name,
    })),
  ];
  for (let index = animationCandidates.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [animationCandidates[index], animationCandidates[swapIndex]] = [
      animationCandidates[swapIndex],
      animationCandidates[index],
    ];
  }

  return {
    ok: true,
    winners: [{
      id: winner.id,
      name: winner.name,
      phoneLast4: phoneLast4(winner.phone),
      phoneVerified: winner.phoneVerifiedAt !== null,
      province: winner.province,
      registeredAt: winner.createdAt.toISOString(),
    }],
    animationCandidates,
    remainingEligible: members.length - 1,
  };
}
