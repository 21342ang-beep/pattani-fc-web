import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import PageHero from "../_components/PageHero";
import OnSaleMatchBoard from "../_components/OnSaleMatchBoard";
import { prisma } from "@/lib/prisma";
import { aggregateZoneAvailability, getSeatAvailabilityForMatches } from "@/lib/seat-availability";
import { type StadiumZoneCode } from "@/lib/stadium-zones";
import { getT } from "@/lib/i18n/server";
import { intlLocale, localize } from "@/lib/i18n/text";
import type { Locale } from "@/lib/i18n/dict";

export const metadata = { title: "จองตั๋วรายแมตช์ — Pattani FC" };

// โซนที่นั่ง Rainbow Stadium — ราคาต่อใบ (บาท) ตามแผนผังสนามจริง
// สี (zoneColor) อิงจากสีบล็อกในแผนผังสนาม stadium-zones-2026-27.png
// AWAY = สำหรับแฟนทีมเยือนเท่านั้น
type ZoneColor = "yellow" | "orange" | "red" | "green" | "blue" | "purple";
type StadiumZone = {
  code: StadiumZoneCode;
  label: string;
  priceBaht: number;
  capacity: number | null;
  remaining: number;
  seasonReserved: number;
  sharedCapacity: boolean;
  color: ZoneColor;
  note?: string;
};
const STADIUM_ZONES: StadiumZone[] = [
  { code: "A", label: "อัฒจันทร์เหนือ · A", priceBaht: 150, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "blue" },
  { code: "B", label: "อัฒจันทร์เหนือ · B", priceBaht: 150, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "blue" },
  { code: "C", label: "อัฒจันทร์ฝั่งตะวันออก · C", priceBaht: 120, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "D", label: "อัฒจันทร์ฝั่งตะวันออก · D", priceBaht: 100, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "orange" },
  { code: "E", label: "อัฒจันทร์ใต้ · E", priceBaht: 120, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "F", label: "อัฒจันทร์ใต้ · F", priceBaht: 150, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "blue" },
  { code: "G", label: "อัฒจันทร์ใต้ · G", priceBaht: 120, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "I", label: "อัฒจันทร์ฝั่งตะวันตก · I", priceBaht: 100, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "orange" },
  { code: "J", label: "อัฒจันทร์ฝั่งตะวันตก · J", priceBaht: 120, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "AWAY", label: "ทีมเยือน", priceBaht: 200, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "purple", note: "สำหรับแฟนทีมเยือนเท่านั้น" },
];

export default async function TicketsPage() {
  const [onSaleMatches, { locale }] = await Promise.all([prisma.match.findMany({
    where: { status: "ON_SALE" }, orderBy: { kickoffAt: "asc" },
  }), getT()]);
  const t = (th: string, en: string) => localize(locale, th, en);
  const availabilityByMatch = await getSeatAvailabilityForMatches(onSaleMatches);
  const availabilityByZone = aggregateZoneAvailability(availabilityByMatch);
  const displayZones = STADIUM_ZONES.map((zone) => ({
    ...zone,
    capacity: availabilityByZone[zone.code].capacity,
    remaining: availabilityByZone[zone.code].remaining,
    seasonReserved: availabilityByZone[zone.code].seasonReserved,
    sharedCapacity: availabilityByZone[zone.code].sharedCapacity,
  }));
  return (
    <>
      <PageHero
        title={t("จองตั๋วรายแมตช์", "Match Tickets")}
        subtitle={t("เลือกโซนที่นั่งของคุณ — แต่ละโซนของ Rainbow Stadium มีบรรยากาศ ราคา และทัศนียภาพต่างกัน", "Choose your seating zone — each area of Rainbow Stadium offers a different atmosphere, price, and view")}
      />

      {/* 1) เลือกโซนที่นั่ง + แผนผังสนาม (อยู่บน) */}
      {onSaleMatches.length > 0 && (
        <section id="matches" className="mx-auto max-w-6xl px-4 pt-12 md:pt-16 scroll-mt-24">
          <div className="mb-6">
            <p className="text-base font-bold uppercase tracking-widest text-emerald-700 md:text-lg">{t("จองเลย", "Book now")}</p>
            <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">{t("โปรแกรมที่เปิดจอง", "Matches on Sale")}</h2>
            <p className="mt-2 text-lg text-slate-600 md:text-xl lg:text-2xl">{t("เลือกแมตช์ที่ต้องการ แล้วจองตั๋วได้ทันที", "Choose a match and book your tickets now")}</p>
          </div>
          <div className="space-y-4">
            {onSaleMatches.map((match) => (
              <OnSaleMatchBoard
                key={match.id}
                match={match}
                showBookingButton={false}
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-12 md:pt-16">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl">
            <MapPin className="size-5" />
            {t("โซนที่นั่ง", "Seating Zones")}
          </p>
          <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">
            {t("เลือกโซนที่นั่งของคุณ", "Choose Your Seating Zone")}
          </h2>
          <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">
            {t("Rainbow Stadium · ปัตตานี — ความจุ 10,700 ที่นั่ง · ราคา 100–200 บาท", "Rainbow Stadium · Pattani — Capacity 10,700 · Tickets THB 100–200")}
          </p>
        </div>

        {/* แผนผังสนาม — โชว์บนสุด ให้คนดูมุมมองก่อนเลือกโซน */}
        <div className="relative aspect-[1463/1058] w-full">
            <Image
                src="/stadium-zones-match-2026-27-v5.png"
              alt={t("แผนผังโซนที่นั่งของ Rainbow Stadium — Pattani FC (ความจุ 10,700)", "Rainbow Stadium seating plan — Pattani FC (capacity 10,700)")}
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-contain"
            />
        </div>
        <p className="mt-5 text-center text-xl leading-relaxed text-slate-500 md:text-2xl lg:text-3xl">
          {t("ดูมุมมองที่คุณต้องการก่อน แล้วเลือกโซนจากตารางด้านล่าง", "Review the stadium view, then choose a zone below")}
        </p>

        {/* ตารางราคาแยกตามโซน — ต่อจากแผนผัง */}
        <p className="mb-10 mt-14 text-center text-xl font-medium leading-relaxed text-slate-500 md:text-2xl lg:text-3xl">
          {t("สีของแต่ละโซนอ้างอิงจากแผนผังสนามด้านบน — กดที่โซนเพื่อเลือกแมตช์", "Zone colors match the stadium plan above — select a zone to choose a match")}
        </p>
        <ul id="zones" className="grid scroll-mt-24 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {displayZones.map((z) => (
            <li key={z.code}>
              <Link
                href={`/matches?zone=${z.code}`}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 rounded-2xl"
                aria-label={`${t("เลือกโซน", "Choose zone")} ${z.code} · ${z.priceBaht} ${t("บาท", "THB")}`}
              >
                <ZoneCard zone={z} locale={locale} />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-lg leading-relaxed text-slate-500 md:text-xl lg:text-2xl">
          {t("* ราคาข้างต้นเป็นราคามาตรฐาน อาจปรับตามแมตช์/คู่แข่ง — การเลือกที่นั่งจริงจะเปิดในขั้นตอนถัดไป", "* Standard prices may vary by match or opponent. Seat selection opens in the next step.")}
        </p>
      </section>

      {/* 2) ขั้นตอนการจอง — คั่นกลาง */}
      <div className="mx-auto max-w-4xl space-y-7 px-4 py-12 md:py-16">
        <section className="rounded-2xl border border-green-100 bg-white p-7 shadow-sm md:p-10 lg:p-12">
          <h2 className="text-3xl font-black text-green-900 md:text-4xl lg:text-5xl">
            {t("ขั้นตอนการจอง", "How to Book")}
          </h2>
          <ol className="mt-7 space-y-5 text-lg text-slate-700 md:text-xl lg:text-2xl">
            <Step n={1}>{t("เลือกแมตช์ที่ต้องการจากตารางโปรแกรมการแข่งขัน", "Choose a match from the fixtures")}</Step>
            <Step n={2}>{t("กรอกข้อมูลผู้จองและจำนวนใบที่ต้องการ (สูงสุด 10 ใบ/รายการ)", "Enter your details and ticket quantity (up to 10 per booking)")}</Step>
            <Step n={3}>{t("ดำเนินการชำระเงินผ่าน PromptPay / Mobile Banking / Credit Card", "Pay via PromptPay, Mobile Banking, or Credit Card")}</Step>
            <Step n={4}>{t("รับ E-Ticket ทันที — แสดง QR ที่ประตูสนามในวันแข่ง", "Receive your E-Ticket and show its QR code at the stadium entrance")}</Step>
          </ol>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/matches"
            className="rounded-full bg-green-800 px-7 py-3.5 text-lg font-semibold text-yellow-300 transition hover:bg-green-900 md:px-8 md:py-4 md:text-xl"
          >
            {t("ดูโปรแกรมการแข่งขัน", "View Fixtures")}
          </Link>
          <Link
            href="/bookings/search"
            className="rounded-full border border-green-200 bg-white px-7 py-3.5 text-lg font-medium text-green-900 transition hover:bg-green-50 md:px-8 md:py-4 md:text-xl"
          >
            {t("ตรวจสอบการจอง", "Check Booking")}
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
    wrap: "border-[#7DD3F7] bg-[#7DD3F7]/15",
    header: "bg-[#7DD3F7]",
    headerText: "text-slate-950",
    price: "text-cyan-700",
    pill: "bg-[#7DD3F7] text-slate-950",
  },
  purple: {
    wrap: "border-fuchsia-400 bg-fuchsia-50/50",
    header: "bg-fuchsia-600",
    headerText: "text-white",
    price: "text-fuchsia-700",
    pill: "bg-fuchsia-600 text-white",
  },
};

function ZoneCard({ zone, locale }: { zone: StadiumZone; locale: Locale }) {
  const s = ZONE_COLORS[zone.color];
  const t = (th: string, en: string) => localize(locale, th, en);
  const englishZoneLabel: Record<StadiumZoneCode, string> = {
    A: "North Stand · A", B: "North Stand · B", C: "East Stand · C",
    D: "East Stand · D", E: "South Stand · E", F: "South Stand · F",
    G: "South Stand · G", I: "West Stand · I", J: "West Stand · J", AWAY: "Away Fans",
  };
  const malayZoneLabel: Record<StadiumZoneCode, string> = {
    A: "Tempat Duduk Utara · A", B: "Tempat Duduk Utara · B", C: "Tempat Duduk Timur · C",
    D: "Tempat Duduk Timur · D", E: "Tempat Duduk Selatan · E", F: "Tempat Duduk Selatan · F",
    G: "Tempat Duduk Selatan · G", I: "Tempat Duduk Barat · I", J: "Tempat Duduk Barat · J", AWAY: "Penyokong Pelawat",
  };
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-2xl border-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${s.wrap}`}
    >
      {/* หัวการ์ดสี — เด่นตามแผนผังสนาม */}
      <div className={`px-5 pb-5 pt-4 ${s.header}`}>
        <span
          className={`text-xl font-bold uppercase tracking-widest ${s.headerText} opacity-80 md:text-2xl`}
        >
          {t("โซน", "Zone")}
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
          {locale === "th" ? zone.label : locale === "ms" ? malayZoneLabel[zone.code] : englishZoneLabel[zone.code]}
        </span>
        <span className={`mt-3 text-3xl font-black ${s.price}`}>
          {zone.priceBaht.toLocaleString("th-TH")}
          <span className="ml-1 text-base font-medium text-slate-500">{t("บาท", "THB")}</span>
        </span>
        <span className="mt-3 text-xl font-semibold leading-tight text-slate-500 md:text-2xl">
          {zone.capacity == null ? t("ยังไม่เปิดขาย", "Not on sale yet") : `${t("คงเหลือ", "Remaining")} ${zone.remaining.toLocaleString(intlLocale(locale))} ${t("ที่นั่ง", "seats")}`}
        </span>
        {zone.capacity != null && (
          <span className="mt-1 text-base font-medium text-slate-500 md:text-lg">
            {t("จาก", "of")} {zone.capacity.toLocaleString(intlLocale(locale))} {t("ที่นั่ง", "seats")}
            {zone.sharedCapacity ? t(" · โควตาร่วมเดิม", " · shared quota") : ""}
          </span>
        )}
        {zone.note && (
          <span
            className={`mt-4 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${s.pill}`}
          >
            <Users className="size-4" /> {locale === "th" ? zone.note : locale === "ms" ? "Untuk penyokong pelawat sahaja" : "Away fans only"}
          </span>
        )}
      </div>
    </div>
  );
}
