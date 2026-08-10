import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import MemberPrizeDraw from "./MemberPrizeDraw";

export const dynamic = "force-dynamic";
export const metadata = { title: "สุ่มรายชื่อสมาชิกรับรางวัล — Pattani FC Admin" };

export default async function MemberDrawPage() {
  await verifyPermission("MEMBER_DATA");

  const totalMembers = await prisma.customer.count();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <Link href="/admin/members" className="text-base font-semibold text-green-800 hover:underline">
          ← กลับไปข้อมูลสมาชิก
        </Link>
        <h1 className="mt-2 text-3xl font-black text-green-950 md:text-4xl">จับรางวัลสมาชิก</h1>
        <p className="mt-1 text-base text-slate-600 md:text-lg">
          สุ่มรายชื่อสมาชิกอย่างโปร่งใสจากฐานข้อมูลปัจจุบัน โดยไม่แก้ไขข้อมูลสมาชิก
        </p>
      </header>

      <MemberPrizeDraw totalMembers={totalMembers} />
    </div>
  );
}
