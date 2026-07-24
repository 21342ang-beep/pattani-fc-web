import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import PageHero from "../_components/PageHero";
import OnSaleMatchBoard from "../_components/OnSaleMatchBoard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "จองตั๋วรายแมตช์ — Pattani FC" };

// โซนที่นั่ง Rainbow Stadium — ราคาต่อใบ (บาท) ตามแผนผังสนามจริง
// สี (zoneColor) อิงจากสีบล็อกในแผนผังสนาม stadium-zones-2026-27.png
// AWAY = สำหรับแฟนทีมเยือนเท่านั้น
type ZoneColor = "yellow" | "orange" | "red" | "green" | "blue" | "purple";
type StadiumZone = {
  code: string;
  label: string;
  priceBaht: number;
  capacity: number | null;
  color: ZoneColor;
  note?: string;
};
const STADIUM_ZONES: StadiumZone[] = [
  { code: "A", label: "อัฒจันทร์เหนือ · A", priceBaht: 150, capacity: null, color: "green" },
  { code: "B", label: "อัฒจันทร์เหนือ · B", priceBaht: 150, capacity: null, color: "green" },
  { code: "C", label: "อัฒจันทร์ฝั่งตะวันออก · C", priceBaht: 120, capacity: null, color: "yellow" },
  { code: "D", label: "อัฒจันทร์ฝั่งตะวันออก · D", priceBaht: 100, capacity: null, color: "orange" },
  { code: "E", label: "อัฒจันทร์ใต้ · E", priceBaht: 120, capacity: null, color: "yellow" },
  { code: "F", label: "อัฒจันทร์ใต้ · F", priceBaht: 150, capacity: null, color: "green" },
  { code: "G", label: "อัฒจันทร์ใต้ · G", priceBaht: 120, capacity: null, color: "yellow" },
  { code: "I", label: "อัฒจันทร์ฝั่งตะวันตก · I", priceBaht: 100, capacity: null, color: "orange" },
  { code: "J", label: "อัฒจันทร์ฝั่งตะวันตก · J", priceBaht: 120, capacity: null, color: "yellow" },
  { code: "AWAY", label: "ทีมเยือน", priceBaht: 200, capacity: null, color: "purple", note: "สำหรับแฟนทีมเยือนเท่านั้น" },
];

export default async function TicketsPage() {
  const onSaleMatches = await prisma.match.findMany({
    where: { status: "ON_SALE" }, orderBy: { kickoffAt: "asc" },
  });
  const capacityFor = (field: "zone150Seats" | "zone120Seats" | "zone100Seats" | "zoneAwaySeats") => {
    const capacities = onSaleMatches.map((match) => match[field]).filter((capacity): capacity is number => capacity != null);
    return capacities.length > 0 ? capacities.reduce((sum, capacity) => sum + capacity, 0) : null;
  };
  const capacitiesByPrice = {
    100: capacityFor("zone100Seats"),
    120: capacityFor("zone120Seats"),
    150: capacityFor("zone150Seats"),
    200: capacityFor("zoneAwaySeats"),
  } as const;
  const displayZones = STADIUM_ZONES.map((zone) => ({
    ...zone,
    capacity: capacitiesByPrice[zone.priceBaht as 100 | 120 | 150 | 200],
  }));
  return (
    <>
      <PageHero
        title="จองตั๋วรายแมตช์"
        subtitle="เลือกโซนที่นั่งของคุณ — แต่ละโซนของ Rainbow Stadium มีบรรยากาศ ราคา และทัศนียภาพต่างกัน"
      />

      {/* 1) เลือกโซนที่นั่ง + แผนผังสนาม (อยู่บน) */}
      {onSaleMatches.length > 0 && (
        <section id="matches" className="mx-auto max-w-6xl px-4 pt-12 md:pt-16 scroll-mt-24">
          <div className="mb-6">
            <p className="text-base font-bold uppercase tracking-widest text-emerald-700 md:text-lg">Book now</p>
            <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">โปรแกรมที่เปิดจอง</h2>
            <p className="mt-2 text-lg text-slate-600 md:text-xl lg:text-2xl">เลือกแมตช์ที่ต้องการ แล้วจองตั๋วได้ทันที</p>
          </div>
          <div className="space-y-4">{onSaleMatches.map((match) => <OnSaleMatchBoard key={match.id} match={match} showBookingButton={false} />)}</div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-12 md:pt-16">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl">
            <MapPin className="size-5" />
            โซนที่นั่ง
          </p>
          <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">
            เลือกโซนที่นั่งของคุณ
          </h2>
          <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">
            Rainbow Stadium · ปัตตานี — ความจุ 10,700 ที่นั่ง · ราคา 100–200 บาท
          </p>
        </div>

        {/* แผนผังสนาม — โชว์บนสุด ให้คนดูมุมมองก่อนเลือกโซน */}
        <div className="relative aspect-[1553/1053] w-full">
            <Image
                src="/stadium-zones-match-2026-27-v3.png"
              alt="แผนผังโซนที่นั่งของ Rainbow Stadium — Pattani FC (ความจุ 10,700)"
              fill
              priority
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-contain"
            />
        </div>
        <p className="mt-5 text-center text-xl leading-relaxed text-slate-500 md:text-2xl lg:text-3xl">
          ดูมุมมองที่คุณต้องการก่อน แล้วเลือกโซนจากตารางด้านล่าง
        </p>

        {/* ตารางราคาแยกตามโซน — ต่อจากแผนผัง */}
        <p className="mb-10 mt-14 text-center text-xl font-medium leading-relaxed text-slate-500 md:text-2xl lg:text-3xl">
          สีของแต่ละโซนอ้างอิงจากแผนผังสนามด้านบน — กดที่โซนเพื่อเลือกแมตช์
        </p>
        <ul id="zones" className="grid scroll-mt-24 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {displayZones.map((z) => (
            <li key={z.code}>
              <Link
                href={`/matches?zone=${z.code}`}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 rounded-2xl"
                aria-label={`เลือกโซน ${z.code} ราคา ${z.priceBaht} บาท — ไปหน้าเลือกแมตช์`}
              >
                <ZoneCard zone={z} />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-lg leading-relaxed text-slate-500 md:text-xl lg:text-2xl">
          * ราคาข้างต้นเป็นราคามาตรฐาน อาจปรับตามแมตช์/คู่แข่ง — Logic การเลือกที่นั่งจริงจะเปิดในขั้นตอนถัดไป
        </p>
      </section>

      {/* 2) ขั้นตอนการจอง — คั่นกลาง */}
      <div className="mx-auto max-w-4xl space-y-7 px-4 py-12 md:py-16">
        <section className="rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-10 lg:p-12">
          <h2 className="text-3xl font-black text-green-900 md:text-4xl lg:text-5xl">
            ขั้นตอนการจอง
          </h2>
          <ol className="mt-7 space-y-5 text-lg text-slate-700 md:text-xl lg:text-2xl">
            <Step n={1}>เลือกแมตช์ที่ต้องการจากตารางโปรแกรมการแข่งขัน</Step>
            <Step n={2}>กรอกข้อมูลผู้จองและจำนวนใบที่ต้องการ (สูงสุด 10 ใบ/รายการ)</Step>
            <Step n={3}>ดำเนินการชำระเงินผ่าน PromptPay / Mobile Banking / Credit Card</Step>
            <Step n={4}>รับ E-Ticket ทันที — แสดง QR ที่ประตูสนามในวันแข่ง</Step>
          </ol>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/matches"
            className="rounded-full bg-green-800 px-7 py-3.5 text-lg font-semibold text-yellow-300 transition hover:bg-green-900 md:px-8 md:py-4 md:text-xl"
          >
            ดูโปรแกรมการแข่งขัน
          </Link>
          <Link
            href="/bookings/search"
            className="rounded-full border border-green-200 bg-white px-7 py-3.5 text-lg font-medium text-green-900 transition hover:bg-green-50 md:px-8 md:py-4 md:text-xl"
          >
            ตรวจสอบการจอง
          </Link>
        </div>
      </div>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4 md:gap-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-base font-bold text-green-950 md:size-10 md:text-lg lg:size-11 lg:text-xl">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

// สไตล์สีของแต่ละโซน — อิงสีบล็อกจากแผนผังสนาม (stadium-zones-2026-27.png)
const ZONE_COLORS: Record<
  ZoneColor,
  { wrap: string; header: string; headerText: string; price: string; pill: string }
> = {
  yellow: {
    wrap: "border-yellow-400 bg-yellow-50/50",
    header: "bg-yellow-400",
    headerText: "text-green-950",
    price: "text-yellow-700",
    pill: "bg-yellow-400 text-green-950",
  },
  orange: {
    wrap: "border-orange-400 bg-orange-50/50",
    header: "bg-orange-500",
    headerText: "text-white",
    price: "text-orange-700",
    pill: "bg-orange-500 text-white",
  },
  red: {
    wrap: "border-red-400 bg-red-50/50",
    header: "bg-red-600",
    headerText: "text-white",
    price: "text-red-700",
    pill: "bg-red-600 text-white",
  },
  green: {
    wrap: "border-green-500 bg-green-50/50",
    header: "bg-green-600",
    headerText: "text-white",
    price: "text-green-700",
    pill: "bg-green-600 text-white",
  },
  blue: {
    wrap: "border-blue-400 bg-blue-50/50",
    header: "bg-blue-600",
    headerText: "text-white",
    price: "text-blue-700",
    pill: "bg-blue-600 text-white",
  },
  purple: {
    wrap: "border-fuchsia-400 bg-fuchsia-50/50",
    header: "bg-fuchsia-600",
    headerText: "text-white",
    price: "text-fuchsia-700",
    pill: "bg-fuchsia-600 text-white",
  },
};

function ZoneCard({ zone }: { zone: StadiumZone }) {
  const s = ZONE_COLORS[zone.color];
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-2xl border-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${s.wrap}`}
    >
      {/* หัวการ์ดสี — เด่นตามแผนผังสนาม */}
      <div className={`px-5 pb-5 pt-4 ${s.header}`}>
        <span
          className={`text-xl font-bold uppercase tracking-widest ${s.headerText} opacity-80 md:text-2xl`}
        >
          โซน
        </span>
        <span
          className={`mt-1 block text-5xl font-black leading-none ${s.headerText}`}
        >
          {zone.code}
        </span>
      </div>

      {/* เนื้อการ์ด */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <span className="text-xl font-bold leading-tight text-slate-700">
          {zone.label}
        </span>
        <span className={`mt-3 text-3xl font-black ${s.price}`}>
          {zone.priceBaht.toLocaleString("th-TH")}
          <span className="ml-1 text-base font-medium text-slate-500">บาท</span>
        </span>
        <span className="mt-3 text-xl font-semibold leading-tight text-slate-500 md:text-2xl">
          {zone.capacity == null ? "ยังไม่เปิดขาย" : `${zone.capacity.toLocaleString("th-TH")} ที่นั่งเปิดขาย`}
        </span>
        {zone.note && (
          <span
            className={`mt-4 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${s.pill}`}
          >
            <Users className="size-4" /> {zone.note}
          </span>
        )}
      </div>
    </div>
  );
}
