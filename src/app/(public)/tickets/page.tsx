import Image from "next/image";
import Link from "next/link";
import {
  Crown,
  Star,
  Award,
  Medal,
  Check,
  Sparkles,
  MapPin,
  Users,
  CalendarRange,
} from "lucide-react";
import PageHero from "../_components/PageHero";
import {
  SEASON_MATCHES,
  SEASON_TIERS,
  type SeasonTier,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";

export const metadata = { title: "จองตั๋ว — Pattani FC" };

// โซนที่นั่ง Rainbow Stadium — ราคาต่อใบ (บาท) ตามแผนผังสนามจริง
// AWAY = สำหรับแฟนทีมเยือนเท่านั้น
type ZoneKind = "premium" | "standard" | "away";
type StadiumZone = {
  code: string;
  label: string;
  priceBaht: number;
  capacity: number;
  kind: ZoneKind;
  note?: string;
};
const STADIUM_ZONES: StadiumZone[] = [
  { code: "N1", label: "เหนือ · พรีเมียม", priceBaht: 170, capacity: 546, kind: "premium" },
  { code: "N2", label: "เหนือ", priceBaht: 150, capacity: 840, kind: "premium" },
  { code: "S", label: "ใต้ · กลางสนาม", priceBaht: 150, capacity: 1496, kind: "premium" },
  { code: "W", label: "ตะวันตก", priceBaht: 100, capacity: 2065, kind: "standard" },
  { code: "E", label: "ตะวันออก", priceBaht: 100, capacity: 2987, kind: "standard" },
  { code: "S1", label: "ใต้-ตะวันตก", priceBaht: 120, capacity: 500, kind: "standard" },
  { code: "S2", label: "ใต้-ตะวันออก", priceBaht: 120, capacity: 500, kind: "standard" },
  { code: "AWAY", label: "ทีมเยือน", priceBaht: 200, capacity: 1000, kind: "away", note: "สำหรับแฟนทีมเยือนเท่านั้น" },
];

// icon แยกจากข้อมูลใน lib/season-pass-tiers.ts (lib ต้อง import ได้จากทั้ง server/client)
const TIER_ICONS: Record<SeasonTierId, React.ReactNode> = {
  "vvip-elite": <Crown className="size-7" />,
  "vip-advanced": <Star className="size-7" />,
  premium: <Award className="size-7" />,
  gold: <Medal className="size-7" />,
};

export default function TicketsPage() {
  return (
    <>
      <PageHero
        title="จองตั๋ว"
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
        <div className="mb-6 mt-10 flex flex-wrap items-center justify-center gap-3 text-xs">
          <LegendChip color="yellow" label="พรีเมียม 150–170 บาท" />
          <LegendChip color="slate" label="ทั่วไป 100–120 บาท" />
          <LegendChip color="rose" label="ทีมเยือน 200 บาท" />
        </div>
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

      {/* 3) บัตรสมาชิกรายปี — ล่างสุด */}
      <div className="mx-auto max-w-7xl px-4 pb-14 md:pb-20">
        <div className="mb-8 text-center md:mb-10">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-yellow-600">
            <CalendarRange className="size-4" />
            บัตรสมาชิกรายปี
          </p>
          <h2 className="mt-1.5 text-4xl font-black text-green-900 md:text-5xl">
            เลือกแพ็กเกจสมาชิกของคุณ
          </h2>
          <p className="mt-2 text-base text-slate-600 md:text-lg">
            ซื้อครั้งเดียว · ดู {SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SEASON_TIERS.map((t) => (
            <TierCard key={t.id} tier={t} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          * บัตรสมาชิกรายปีครอบคลุมเฉพาะแมตช์เหย้าในฤดูกาลปัจจุบัน — ไม่รวมเกมนัดพิเศษ/ทัวร์นาเมนต์นานาชาติ
        </p>
      </div>
    </>
  );
}

function TierCard({ tier }: { tier: SeasonTier }) {
  const highlighted = tier.highlight;
  const priceLabel = tier.priceBaht.toLocaleString("th-TH");
  const unitLabel = `บาท / ฤดูกาล · ${SEASON_MATCHES} แมตช์`;
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-3xl border-2 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl md:p-7 ${
        highlighted
          ? "border-yellow-400 bg-gradient-to-b from-green-900 to-green-950 text-yellow-100 shadow-yellow-400/10"
          : "border-green-100 bg-white"
      }`}
    >
      {tier.ribbon && (
        <div className="absolute right-0 top-5 rounded-l-full bg-yellow-400 px-4 py-1.5 text-xs font-bold text-green-950 shadow">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3.5" /> {tier.ribbon}
          </span>
        </div>
      )}

      <div
        className={`mb-4 inline-flex size-14 items-center justify-center rounded-2xl ${
          highlighted
            ? "bg-yellow-400 text-green-950"
            : "bg-green-100 text-green-800"
        }`}
      >
        {TIER_ICONS[tier.id]}
      </div>

      <p
        className={`text-xs font-bold uppercase tracking-widest ${
          highlighted ? "text-yellow-300/80" : "text-yellow-600"
        }`}
      >
        {tier.badge}
      </p>
      <h3
        className={`mt-1 text-2xl font-black md:text-3xl ${
          highlighted ? "text-yellow-300" : "text-green-900"
        }`}
      >
        {tier.name}
      </h3>
      <p
        className={`mt-1 text-sm ${
          highlighted ? "text-yellow-100/80" : "text-slate-600"
        }`}
      >
        {tier.tagline}
      </p>

      <div
        className={`mt-5 border-y py-4 ${
          highlighted ? "border-yellow-300/20" : "border-green-100"
        }`}
      >
        <div className="flex items-baseline gap-2">
          <span
            className={`text-4xl font-black md:text-5xl ${
              highlighted ? "text-yellow-300" : "text-green-900"
            }`}
          >
            {priceLabel}
          </span>
          <span
            className={`text-sm ${
              highlighted ? "text-yellow-100/70" : "text-slate-500"
            }`}
          >
            {unitLabel}
          </span>
        </div>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {tier.benefits.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm md:text-base">
            <Check
              className={`mt-1 size-4 shrink-0 ${
                highlighted ? "text-yellow-300" : "text-green-700"
              }`}
            />
            <span
              className={
                highlighted ? "text-yellow-100/95" : "text-slate-700"
              }
            >
              {b}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={`/season-pass/apply?tier=${tier.id}`}
        className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-base font-bold transition ${
          highlighted
            ? "bg-yellow-400 text-green-950 hover:bg-yellow-300"
            : "bg-green-800 text-yellow-300 hover:bg-green-900"
        }`}
      >
        ซื้อบัตรสมาชิกรายปี
      </Link>
    </div>
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

function ZoneCard({ zone }: { zone: StadiumZone }) {
  const styles: Record<
    ZoneKind,
    { wrap: string; eyebrow: string; code: string; price: string; pill: string }
  > = {
    premium: {
      wrap: "border-yellow-400/70 bg-gradient-to-b from-yellow-50 to-white",
      eyebrow: "text-green-900/60",
      code: "text-green-900",
      price: "text-yellow-700",
      pill: "bg-yellow-400 text-green-950",
    },
    standard: {
      wrap: "border-slate-200 bg-white",
      eyebrow: "text-green-900/60",
      code: "text-green-900",
      price: "text-green-800",
      pill: "bg-green-800 text-yellow-300",
    },
    away: {
      wrap: "border-rose-300 bg-gradient-to-b from-rose-50 to-white",
      eyebrow: "text-rose-900/60",
      code: "text-rose-900",
      price: "text-rose-700",
      pill: "bg-rose-600 text-white",
    },
  };
  const s = styles[zone.kind];
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border-2 p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${s.wrap}`}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-widest ${s.eyebrow}`}
      >
        โซน
      </span>
      <span className={`mt-1 text-3xl font-black ${s.code}`}>{zone.code}</span>
      <span className={`mt-0.5 text-[11px] font-medium ${s.eyebrow}`}>
        {zone.label}
      </span>
      <span className={`mt-2 text-lg font-black ${s.price}`}>
        {zone.priceBaht.toLocaleString("th-TH")}
        <span className="ml-1 text-xs font-medium opacity-70">บาท</span>
      </span>
      <span className={`mt-1 text-[11px] ${s.eyebrow}`}>
        {zone.capacity.toLocaleString("th-TH")} ที่นั่ง
      </span>
      {zone.note && (
        <span
          className={`mt-2 inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${s.pill}`}
        >
          <Users className="size-3" /> {zone.note}
        </span>
      )}
    </div>
  );
}

function LegendChip({
  color,
  label,
}: {
  color: "yellow" | "slate" | "rose";
  label: string;
}) {
  const map: Record<typeof color, string> = {
    yellow: "border-yellow-400 bg-yellow-50 text-yellow-900",
    slate: "border-slate-300 bg-white text-slate-700",
    rose: "border-rose-300 bg-rose-50 text-rose-800",
  };
  const dotMap: Record<typeof color, string> = {
    yellow: "bg-yellow-400",
    slate: "bg-green-800",
    rose: "bg-rose-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold ${map[color]}`}
    >
      <span className={`size-2 rounded-full ${dotMap[color]}`} />
      {label}
    </span>
  );
}
