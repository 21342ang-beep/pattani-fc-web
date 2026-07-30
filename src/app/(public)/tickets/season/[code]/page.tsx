import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Barcode, CalendarDays, DoorOpen, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyCustomer } from "@/lib/customer-dal";
import { formatDateTime } from "@/lib/format";
import { getSeasonTier } from "@/lib/season-pass-tiers";

export const dynamic = "force-dynamic";

const gateBySeatZone: Record<string, string> = {
  "VVIP-A": "A",
  "VIP-A": "A",
  "PRIMIUM-A": "A",
  "VVIP-B": "B",
  "VIP-B": "B",
  "PRIMIUM-B": "B",
  "PRIMIUM-F": "F1 / F2",
  "GOLD-C": "C",
  "GOLD-E": "E",
  "GOLD-G": "G",
  "GOLD-J": "J",
};

function getGateForSeatZone(seatZone: string) {
  return gateBySeatZone[seatZone.trim().toUpperCase()] ?? "ตรวจสอบกับเจ้าหน้าที่";
}

export default async function SeasonPassTicketPage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, customer] = await Promise.all([params, verifyCustomer()]);
  if (!code || !/^PFC26-[A-Z0-9-]+$/i.test(code)) notFound();

  const pass = await prisma.seasonPassOrder.findFirst({
    where: {
      passCode: code,
      OR: [{ customerId: customer.id }, { customerEmail: { equals: customer.email, mode: "insensitive" } }],
    },
    select: {
      passCode: true, customerName: true, seatZone: true, seasonLabel: true, tierId: true,
      status: true, createdAt: true,
      barcode: { select: { barcode: true, usesRemaining: true } },
    },
  });
  if (!pass) notFound();

  if (pass.status !== "CONFIRMED" || !pass.barcode) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="text-3xl font-black text-amber-700">บัตรยังไม่พร้อมใช้งาน</h1><Link href="/member/bookings" className="mt-6 inline-flex rounded-full bg-green-800 px-6 py-3 font-bold text-yellow-300">กลับไปบัตรของฉัน</Link></div>;
  }

  const tier = getSeasonTier(pass.tierId);
  const gate = getGateForSeatZone(pass.seatZone);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link href="/member/bookings" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-green-800 hover:underline"><ArrowLeft className="size-4" /> กลับไปบัตรของฉัน</Link>
      <article className="overflow-hidden rounded-3xl bg-green-950 text-white shadow-2xl">
        <header className="bg-gradient-to-r from-green-800 to-green-700 px-6 py-6 md:px-9">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-300">Pattani FC · Season Pass</p>
          <div className="mt-3 flex items-end justify-between gap-3"><div><h1 className="text-3xl font-black md:text-4xl">{tier?.name ?? pass.tierId}</h1><p className="mt-1 text-green-100">ฤดูกาล {pass.seasonLabel}</p></div><Image src="/logo-pattani-fc.png" alt="Pattani FC" width={80} height={80} className="size-16 object-contain md:size-20" priority /></div>
        </header>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_250px] md:p-9">
          <div><p className="text-sm text-green-200">ผู้ถือบัตร</p><p className="mt-1 text-2xl font-black">{pass.customerName}</p>
            <div className="mt-6 space-y-3 border-y border-white/15 py-5 text-sm"><p className="flex items-center gap-2"><MapPin className="size-4 text-yellow-300" /> โซนที่นั่ง: <strong>{pass.seatZone}</strong></p><p className="flex items-center gap-2"><DoorOpen className="size-4 text-yellow-300" /> ประตูเข้าสนาม: <strong>Gate {gate}</strong></p><p className="flex items-center gap-2"><CalendarDays className="size-4 text-yellow-300" /> สมัครเมื่อ: {formatDateTime(pass.createdAt)}</p><p className="font-mono text-xs text-green-200">Pass no. {pass.passCode}</p></div>
            <p className="mt-5 text-sm text-green-100">คงสิทธิ์เข้าสนาม {pass.barcode.usesRemaining} นัด</p></div>
          <div className="rounded-2xl bg-white p-4 text-green-950 shadow-inner"><div className="flex items-center justify-center gap-2 text-sm font-bold"><Barcode className="size-5" /> บาร์โค้ดสำหรับเข้าสนาม</div><img src={`/api/season-passes/${encodeURIComponent(pass.barcode.barcode)}/barcode`} alt={`บาร์โค้ด ${pass.barcode.barcode}`} className="mt-3 h-auto w-full" /><p className="mt-2 text-center font-mono text-xs font-bold tracking-wider">{pass.barcode.barcode}</p></div>
        </div>
      </article>
    </div>
  );
}
