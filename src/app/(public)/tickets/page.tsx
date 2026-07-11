import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import PageHero from "../_components/PageHero";

export const metadata = { title: "จองตั๋วรายแมตช์ — Pattani FC" };

// โซนที่นั่ง Rainbow Stadium — ราคาต่อใบ (บาท) ตามแผนผังสนามจริง
// สี (zoneColor) อิงจากสีบล็อกในแผนผังสนาม stadium-zones-v2.jpg
// AWAY = สำหรับแฟนทีมเยือนเท่านั้น
type ZoneColor = "yellow" | "orange" | "red" | "green" | "blue" | "purple";
type StadiumZone = {
  code: string;
  label: string;
  priceBaht: number;
  capacity: number;
  color: ZoneColor;
  note?: string;
};
const STADIUM_ZONES: StadiumZone[] = [
  { code: "N1", label: "เหนือ · พรีเมียม", priceBaht: 170, capacity: 546, color: "yellow" },
  { code: "N2", label: "เหนือ", priceBaht: 150, capacity: 840, color: "orange" },
  { code: "S", label: "ใต้ · กลางสนาม", priceBaht: 150, capacity: 1496, color: "yellow" },
  { code: "W", label: "ตะวันตก", priceBaht: 100, capacity: 2065, color: "red" },
  { code: "E", label: "ตะวันออก", priceBaht: 100, capacity: 2987, color: "red" },
  { code: "S1", label: "ใต้-ตะวันตก", priceBaht: 120, capacity: 500, color: "green" },
  { code: "S2", label: "ใต้-ตะวันออก", priceBaht: 120, capacity: 500, color: "blue" },
  { code: "AWAY", label: "ทีมเยือน", priceBaht: 200, capacity: 1000, color: "purple", note: "สำหรับแฟนทีมเยือนเท่านั้น" },
];

export default function TicketsPage() {
  return (
    <>
      <PageHero
        title="จองตั๋วรายแมตช์"
        subtitle="เลือกโซนที่นั่งของคุณ — แต่ละโซนของ Rainbow Stadium มีบรรยากาศ ราคา และทัศนียภาพต่างกัน"
      />

      {/* 1) เลือกโซนที่นั่ง + แผนผังสนาม (อยู่บน) */}
      <section className="mx-auto max-w-6xl px-4 pt-12 md:pt-16">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-yellow-600">
            <MapPin className="size-4" />
            โซนที่นั่ง
          </p>
          <h2 className="mt-1.5 text-3xl font-black text-green-900 md:text-4xl">
            เลือกโซนที่นั่งของคุณ
          </h2>
          <p className="mt-2 text-base text-slate-600">
            Rainbow Stadium · ปัตตานี — ความจุ 10,700 ที่นั่ง · ราคา 100–200 บาท
          </p>
        </div>

        {/* แผนผังสนาม — โชว์บนสุด ให้คนดูมุมมองก่อนเลือกโซน */}
        <div className="overflow-hidden rounded-3xl border-2 border-green-900/10 bg-[#f3e7c8] p-3 shadow-xl md:p-5">
          <div className="relative aspect-[1553/1053] w-full overflow-hidden rounded-2xl">
            <Image
              src="/stadium-zones-v2.jpg"
              alt="แผนผังโซนที่นั่งของ Rainbow Stadium — Pattani FC (ความจุ 10,700)"
              fill
              priority
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-contain"
            />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          ดูมุมมองที่คุณต้องการก่อน แล้วเลือกโซนจากตารางด้านล่าง
        </p>

        {/* ตารางราคาแยกตามโซน — ต่อจากแผนผัง */}
        <p className="mb-6 mt-10 text-center text-sm font-medium text-slate-500">
          สีของแต่ละโซนอ้างอิงจากแผนผังสนามด้านบน — กดที่โซนเพื่อเลือกแมตช์
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {STADIUM_ZONES.map((z) => (
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

        <p className="mt-4 text-center text-xs text-slate-500">
          * ราคาข้างต้นเป็นราคามาตรฐาน อาจปรับตามแมตช์/คู่แข่ง — Logic การเลือกที่นั่งจริงจะเปิดในขั้นตอนถัดไป
        </p>
      </section>

      {/* 2) ขั้นตอนการจอง — คั่นกลาง */}
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 md:py-16">
        <section className="rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-9">
          <h2 className="text-2xl font-black text-green-900 md:text-3xl">
            ขั้นตอนการจอง
          </h2>
          <ol className="mt-5 space-y-3 text-base text-slate-700">
            <Step n={1}>เลือกแมตช์ที่ต้องการจากตารางโปรแกรมการแข่งขัน</Step>
            <Step n={2}>กรอกข้อมูลผู้จองและจำนวนใบที่ต้องการ (สูงสุด 10 ใบ/รายการ)</Step>
            <Step n={3}>ดำเนินการชำระเงินผ่าน PromptPay / Mobile Banking / Credit Card</Step>
            <Step n={4}>รับ E-Ticket ทันที — แสดง QR ที่ประตูสนามในวันแข่ง</Step>
          </ol>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/matches"
            className="rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-yellow-300 transition hover:bg-green-900"
          >
            ดูโปรแกรมการแข่งขัน
          </Link>
          <Link
            href="/bookings/check"
            className="rounded-full border border-green-200 bg-white px-6 py-3 text-base font-medium text-green-900 transition hover:bg-green-50"
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
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-green-950">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

// สไตล์สีของแต่ละโซน — อิงสีบล็อกจากแผนผังสนาม (stadium-zones-v2.jpg)
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
      <div className={`px-4 pb-4 pt-3 ${s.header}`}>
        <span
          className={`text-sm font-bold uppercase tracking-widest ${s.headerText} opacity-80`}
        >
          โซน
        </span>
        <span
          className={`mt-0.5 block text-4xl font-black leading-none ${s.headerText}`}
        >
          {zone.code}
        </span>
      </div>

      {/* เนื้อการ์ด */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <span className="text-base font-semibold text-slate-700">
          {zone.label}
        </span>
        <span className={`mt-2 text-2xl font-black ${s.price}`}>
          {zone.priceBaht.toLocaleString("th-TH")}
          <span className="ml-1 text-sm font-medium text-slate-500">บาท</span>
        </span>
        <span className="mt-1 text-sm font-medium text-slate-500">
          {zone.capacity.toLocaleString("th-TH")} ที่นั่ง
        </span>
        {zone.note && (
          <span
            className={`mt-3 inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${s.pill}`}
          >
            <Users className="size-3.5" /> {zone.note}
          </span>
        )}
      </div>
    </div>
  );
}

