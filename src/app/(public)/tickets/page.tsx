import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import PageHero from "../_components/PageHero";
import OnSaleMatchBoard from "../_components/OnSaleMatchBoard";
import SeasonPassAnnouncementModal from "../_components/SeasonPassAnnouncementModal";
import type { StadiumModelZone } from "./_components/StadiumModelViewer";
import StadiumModelViewer from "./_components/StadiumModelViewer";
import { prisma } from "@/lib/prisma";
import { aggregateZoneAvailability, getSeatAvailabilityForMatches } from "@/lib/seat-availability";
import {
  getMatchZoneLabel,
  getZoneCapacity,
  getZonePrice,
  type StadiumZoneCode,
} from "@/lib/stadium-zones";
import { getT } from "@/lib/i18n/server";
import { intlLocale, localize } from "@/lib/i18n/text";
import type { Locale } from "@/lib/i18n/dict";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import { activeBookingStatusWhere } from "@/lib/booking-expiry";
import { getMatchTicketZoneButtonLabel } from "@/lib/match-ticket-zone-label";
import { sortTicketZoneCards } from "@/lib/ticket-zone-card-order";

export const metadata = { title: "จองตั๋วรายแมตช์ — Pattani FC" };

// โซนที่นั่ง Rainbow Stadium — ราคาต่อใบ (บาท) ตามแผนผังสนามจริง
// สี (zoneColor) อิงจากสีบล็อกในแผนผังสนาม stadium-zones-2026-27.png
// AWAY = สำหรับแฟนทีมเยือนเท่านั้น
type ZoneColor = "yellow" | "gold" | "orange" | "red" | "green" | "blue" | "purple";
type StadiumZone = {
  code: StadiumZoneCode;
  label: string;
  minPriceBaht: number | null;
  maxPriceBaht: number | null;
  capacity: number | null;
  remaining: number;
  seasonReserved: number;
  sharedCapacity: boolean;
  color: ZoneColor;
  note?: string;
};
type DynamicTicketZone = {
  id: string;
  code: string;
  buttonLabel: string | null;
  name: string;
  price: number;
  capacity: number;
  remaining: number;
  matchId: string;
  matchLabel: string;
  venue: string | null;
};
type DynamicZoneTheme = {
  wrap: string;
  header: string;
  headerText: string;
  price: string;
};
type ZoneCardItem =
  | { kind: "dynamic"; zone: DynamicTicketZone; sourceOrder: number }
  | { kind: "standard"; zone: StadiumZone; sourceOrder: number };
const STADIUM_ZONES: StadiumZone[] = [
  { code: "A", label: "อัฒจันทร์เหนือ · A", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "blue" },
  { code: "B", label: "อัฒจันทร์เหนือ · B", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "blue" },
  { code: "C", label: "อัฒจันทร์ฝั่งตะวันออก · C", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "D", label: "อัฒจันทร์ฝั่งตะวันออก · D", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "orange" },
  { code: "E", label: "อัฒจันทร์ใต้ · E", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "F", label: "อัฒจันทร์ใต้ · F", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "blue" },
  { code: "G", label: "อัฒจันทร์ใต้ · G", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "H", label: "อัฒจันทร์ฝั่งตะวันตก · H", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "orange" },
  { code: "J", label: "อัฒจันทร์ฝั่งตะวันตก · J", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "yellow" },
  { code: "AWAY", label: "ทีมเยือน", minPriceBaht: null, maxPriceBaht: null, capacity: null, remaining: 0, seasonReserved: 0, sharedCapacity: false, color: "purple", note: "สำหรับแฟนทีมเยือนเท่านั้น" },
];

const ENGLISH_ZONE_LABELS: Record<StadiumZoneCode, string> = {
  A: "North Stand · A", B: "North Stand · B", C: "East Stand · C",
  D: "East Stand · D", E: "South Stand · E", F: "South Stand · F",
  G: "South Stand · G", H: "West Stand · H", J: "West Stand · J", AWAY: "Away Fans",
};

const MALAY_ZONE_LABELS: Record<StadiumZoneCode, string> = {
  A: "Tempat Duduk Utara · A", B: "Tempat Duduk Utara · B", C: "Tempat Duduk Timur · C",
  D: "Tempat Duduk Timur · D", E: "Tempat Duduk Selatan · E", F: "Tempat Duduk Selatan · F",
  G: "Tempat Duduk Selatan · G", H: "Tempat Duduk Barat · H", J: "Tempat Duduk Barat · J", AWAY: "Penyokong Pelawat",
};

// Keep the previous 3D/2D implementation ready for reuse, but do not render it
// while the Tinnasulanon Stadium match-ticket plan is active.
const SHOW_LEGACY_STADIUM_VIEWS = false;

const MATCH_ZONE_MAP_DETAILS: Record<StadiumZoneCode, { gate: string; priceBaht: number; color: [string, string, string] }> = {
  A: { gate: "A", priceBaht: 150, color: ["ฟ้า", "Blue", "Biru"] },
  B: { gate: "B", priceBaht: 150, color: ["ฟ้า", "Blue", "Biru"] },
  C: { gate: "C", priceBaht: 120, color: ["เหลือง", "Yellow", "Kuning"] },
  D: { gate: "D", priceBaht: 100, color: ["ส้ม", "Orange", "Jingga"] },
  E: { gate: "E", priceBaht: 120, color: ["เหลือง", "Yellow", "Kuning"] },
  F: { gate: "F1 / F2", priceBaht: 150, color: ["ฟ้า", "Blue", "Biru"] },
  G: { gate: "G", priceBaht: 120, color: ["เหลือง", "Yellow", "Kuning"] },
  H: { gate: "H", priceBaht: 100, color: ["ส้ม", "Orange", "Jingga"] },
  J: { gate: "J", priceBaht: 120, color: ["เหลือง", "Yellow", "Kuning"] },
  AWAY: { gate: "H", priceBaht: 200, color: ["ม่วง", "Purple", "Ungu"] },
};

export default async function TicketsPage() {
  const now = new Date();
  const [availableMatches, upcomingLabelMatch, { locale }, purchaseSettings] = await Promise.all([
    prisma.match.findMany({
      where: { status: "ON_SALE" }, orderBy: { kickoffAt: "asc" },
      include: {
        ticketZones: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        zoneLabels: { select: { code: true, label: true } },
      },
    }),
    prisma.match.findFirst({
      where: { status: "SCHEDULED", kickoffAt: { gte: now } },
      orderBy: [{ kickoffAt: "asc" }, { createdAt: "asc" }],
      include: { zoneLabels: { select: { code: true, label: true } } },
    }),
    getT(),
    getTicketPurchaseSettings(),
  ]);
  const onSaleMatches = availableMatches.filter(
    (match) => match.competitionType !== "LEAGUE" || purchaseSettings.leagueBookingOpen,
  );
  const zoneLabelMatches = [
    ...onSaleMatches,
    ...(upcomingLabelMatch ? [upcomingLabelMatch] : []),
  ];
  const t = (th: string, en: string) => localize(locale, th, en);
  const availabilityByMatch = await getSeatAvailabilityForMatches(onSaleMatches);
  const dynamicBookingGroups = onSaleMatches.length > 0
    ? await prisma.booking.groupBy({
        by: ["matchId", "zone"],
        where: { matchId: { in: onSaleMatches.map((match) => match.id) }, ...activeBookingStatusWhere() },
        _sum: { quantity: true },
      })
    : [];
  const dynamicZones = onSaleMatches.flatMap((match) => match.ticketZones.map((zone) => {
    const booked = dynamicBookingGroups.find(
      (group) => group.matchId === match.id && group.zone === zone.code,
    )?._sum.quantity ?? 0;
    return {
      ...zone,
      matchId: match.id,
      matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
      venue: match.venue,
      remaining: Math.max(0, zone.capacity - booked),
    };
  }));
  const availabilityByZone = aggregateZoneAvailability(availabilityByMatch);
  const displayZones = STADIUM_ZONES.map((zone) => {
    const labelMatch = zoneLabelMatches.find((match) => {
      const capacity = getZoneCapacity(match, zone.code);
      const price = getZonePrice(match, zone.code);
      return capacity != null && capacity > 0 && price != null && price > 0;
    }) ?? zoneLabelMatches[0];
    const prices = onSaleMatches
      .map((match) => getZonePrice(match, zone.code))
      .filter((price): price is number => price != null && price > 0)
      .map((price) => price / 100);
    return {
      ...zone,
      label: labelMatch ? getMatchZoneLabel(labelMatch.zoneLabels, zone.code) : zone.label,
      minPriceBaht: prices.length > 0 ? Math.min(...prices) : null,
      maxPriceBaht: prices.length > 0 ? Math.max(...prices) : null,
      capacity: availabilityByZone[zone.code].capacity,
      remaining: availabilityByZone[zone.code].remaining,
      seasonReserved: availabilityByZone[zone.code].seasonReserved,
      sharedCapacity: availabilityByZone[zone.code].sharedCapacity,
    };
  });
  const zoneCards: ZoneCardItem[] = [
    ...dynamicZones.map((zone, sourceOrder) => ({ kind: "dynamic" as const, zone, sourceOrder })),
    ...displayZones.map((zone, sourceOrder) => ({ kind: "standard" as const, zone, sourceOrder })),
  ];
  sortTicketZoneCards(zoneCards, displayZones.map((zone) => zone.code));
  const modelZones: StadiumModelZone[] = displayZones.map((zone) => {
    const label = locale === "th"
      ? zone.label
      : locale === "ms"
        ? MALAY_ZONE_LABELS[zone.code]
        : ENGLISH_ZONE_LABELS[zone.code];
    const priceLabel = zone.minPriceBaht == null
      ? t("ยังไม่กำหนดราคา", "Price not set")
      : zone.minPriceBaht === zone.maxPriceBaht
        ? `${zone.minPriceBaht.toLocaleString(intlLocale(locale))} ${t("บาท", "THB")}`
        : `${zone.minPriceBaht.toLocaleString(intlLocale(locale))}–${zone.maxPriceBaht?.toLocaleString(intlLocale(locale))} ${t("บาท", "THB")}`;
    const availabilityLabel = zone.capacity == null
      ? t("ยังไม่เปิดขาย", "Not on sale yet")
      : `${t("คงเหลือ", "Remaining")} ${zone.remaining.toLocaleString(intlLocale(locale))} ${t("ที่นั่ง", "seats")} · ${t("จาก", "of")} ${zone.capacity.toLocaleString(intlLocale(locale))}`;
    const note = zone.note
      ? locale === "th"
        ? zone.note
        : locale === "ms"
          ? "Untuk penyokong pelawat sahaja"
          : "Away fans only"
      : undefined;
    const mapDetail = MATCH_ZONE_MAP_DETAILS[zone.code];
    const colorLabel = locale === "th"
      ? `สีประจำโซน: ${mapDetail.color[0]}`
      : locale === "ms"
        ? `Warna zon: ${mapDetail.color[2]}`
        : `Zone color: ${mapDetail.color[1]}`;
    const gateLabel = locale === "th"
      ? `ทางเข้า Gate ${mapDetail.gate}`
      : locale === "ms"
        ? `Pintu masuk Gate ${mapDetail.gate}`
        : `Entrance Gate ${mapDetail.gate}`;
    return {
      code: zone.code,
      label,
      priceLabel,
      availabilityLabel,
      details: [gateLabel, colorLabel],
      note,
    };
  });
  modelZones.push(
    {
      code: "VIP-A",
      label: t("VIP ฝั่ง A", "VIP · Side A"),
      priceLabel: t("สำหรับสมาชิกรายปี", "Season members"),
      availabilityLabel: t("พื้นที่สมาชิก VIP รายปี", "VIP season-member area"),
    },
    {
      code: "VIP-B",
      label: t("VIP ฝั่ง B", "VIP · Side B"),
      priceLabel: t("สำหรับสมาชิกรายปี", "Season members"),
      availabilityLabel: t("พื้นที่สมาชิก VIP รายปี", "VIP season-member area"),
    },
  );
  return (
    <>
      <SeasonPassAnnouncementModal
        initiallyOpen={!purchaseSettings.leagueBookingOpen}
        ticketType="match"
      />

      <PageHero
        title={t("จองตั๋วรายแมตช์", "Match Tickets")}
        subtitle={t("เลือกโซนที่นั่งและตรวจสอบราคาจากแผนผังสนามกีฬาติณสูลานนท์", "Choose your seating zone and check prices on the Tinnasulanon Stadium plan")}
      />

      <span id="matches" className="block scroll-mt-24" aria-hidden="true" />

      {/* 1) เลือกโซนที่นั่ง + แผนผังสนาม (อยู่บน) */}
      {onSaleMatches.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-12 md:pt-16">
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
            {t("สนามกีฬาติณสูลานนท์ · สงขลา — แผนผังและราคาบัตรรายแมตช์", "Tinnasulanon Stadium · Songkhla — Match-ticket seating plan and prices")}
          </p>
        </div>

        {SHOW_LEGACY_STADIUM_VIEWS && <>
        <StadiumModelViewer
          title={t("สนามปัตตานีแบบ 3 มิติ", "Pattani Stadium in 3D")}
          description={t("สำรวจมุมมองรอบสนามก่อนเลือกโซนที่นั่ง", "Explore the stadium before choosing your seating zone")}
          loadingLabel={t("กำลังโหลดโมเดลสนาม", "Loading stadium model")}
          errorLabel={t("อุปกรณ์นี้ไม่สามารถแสดงโมเดล 3 มิติได้", "This device cannot display the 3D model.")}
          interactionLabel={t("ลากเพื่อหมุน · เลื่อนเพื่อซูม", "Drag to rotate · Scroll to zoom")}
          plainBackground
          zones={modelZones}
          zoneHintLabel={t("ชี้หรือแตะโซนเพื่อดูราคาและรายละเอียด", "Hover or tap a zone to see price and details")}
        />
        <p className="mt-5 text-center text-xl leading-relaxed text-slate-500 md:text-2xl lg:text-3xl">
          {t("ดูมุมมองที่คุณต้องการก่อน แล้วเลือกโซนจากตารางด้านล่าง", "Review the stadium view, then choose a zone below")}
        </p>
        </>}

        <figure className="mx-auto mt-8 w-full max-w-6xl md:mt-10">
          <Image
            src="/tinnasulanon-stadium-zones-match-2026-27.png"
            alt={t("แผนผังโซนที่นั่งและราคาบัตรรายแมตช์ สนามกีฬาติณสูลานนท์", "Tinnasulanon Stadium match-ticket seating zones and prices")}
            width={1553}
            height={1058}
            fetchPriority="high"
            sizes="(min-width: 1280px) 1152px, (min-width: 768px) calc(100vw - 4rem), calc(100vw - 2rem)"
            className="h-auto w-full object-contain"
          />
          <figcaption className="px-3 pb-3 pt-2 text-center text-base font-medium text-slate-600 md:text-lg">
            {t("แผนผังบัตรรายแมตช์ · สนามกีฬาติณสูลานนท์", "Match-ticket plan · Tinnasulanon Stadium")}
          </figcaption>
        </figure>

        <p className="mb-10 mt-14 text-center text-xl font-medium leading-relaxed text-slate-500 md:text-2xl lg:text-3xl">
          {t("ตรวจสอบตำแหน่งและราคาจากแผนผังด้านบน แล้วกดที่โซนเพื่อเลือกแมตช์", "Check the location and price on the plan above, then select a zone to choose a match")}
        </p>
        <ul id="zones" className="grid scroll-mt-24 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {zoneCards.map((item) => item.kind === "dynamic" ? (
            <li key={`dynamic-${item.zone.id}`}>
              {item.zone.remaining > 0 ? (
                <Link
                  href={`/matches/${item.zone.matchId}?zone=${encodeURIComponent(item.zone.code)}`}
                  className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  aria-label={`${t("ซื้อบัตร", "Buy ticket")} ${item.zone.name} · ${item.zone.matchLabel}`}
                >
                  <DynamicZoneCard zone={item.zone} locale={locale} />
                </Link>
              ) : (
                <DynamicZoneCard zone={item.zone} locale={locale} />
              )}
            </li>
          ) : (
            <li key={`standard-${item.zone.code}`}>
              <Link
                href={`/matches?zone=${item.zone.code}`}
                className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
                aria-label={`${t("เลือกโซน", "Choose zone")} ${item.zone.code}`}
              >
                <ZoneCard zone={item.zone} locale={locale} />
              </Link>
            </li>
          ))}
        </ul>

        {SHOW_LEGACY_STADIUM_VIEWS && <figure className="mx-auto mb-10 mt-10 w-full max-w-5xl md:mb-12 md:mt-12">
          <Image
            src="/stadium-zones-match-2026-27-v6.png"
            alt={t("แผนผังโซนที่นั่งและราคาบัตรรายแมตช์", "Match ticket seating zones and prices")}
            width={1553}
            height={1058}
            sizes="(min-width: 1280px) 1024px, (min-width: 768px) calc(100vw - 4rem), calc(100vw - 2rem)"
            className="h-auto w-full object-contain"
          />
        </figure>}

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
            <Step n={2}>{t(`กรอกข้อมูลผู้จองและจำนวนใบที่ต้องการ (สูงสุด ${purchaseSettings.matchMaxQuantity} ใบ/รายการ)`, `Enter your details and ticket quantity (up to ${purchaseSettings.matchMaxQuantity} per booking)`)}</Step>
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
  gold: {
    wrap: "border-[#B9983E] bg-amber-50/60",
    header: "bg-[#B9983E]",
    headerText: "text-slate-950",
    price: "text-[#8A6818]",
    pill: "bg-[#B9983E] text-slate-950",
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
          {locale === "th" ? zone.label : locale === "ms" ? MALAY_ZONE_LABELS[zone.code] : ENGLISH_ZONE_LABELS[zone.code]}
        </span>
        <span className={`mt-3 text-3xl font-black ${s.price}`}>
          {zone.minPriceBaht == null
            ? t("ยังไม่กำหนดราคา", "Price not set")
            : zone.minPriceBaht === zone.maxPriceBaht
              ? zone.minPriceBaht.toLocaleString(intlLocale(locale))
              : `${zone.minPriceBaht.toLocaleString(intlLocale(locale))}–${zone.maxPriceBaht?.toLocaleString(intlLocale(locale))}`}
          {zone.minPriceBaht != null && <span className="ml-1 text-base font-medium text-slate-500">{t("บาท", "THB")}</span>}
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

function DynamicZoneCard({ zone, locale }: { zone: DynamicTicketZone; locale: Locale }) {
  const t = (th: string, en: string) => localize(locale, th, en);
  const numberLocale = intlLocale(locale);
  const theme = getDynamicZoneTheme(zone);
  const buttonLabel = getMatchTicketZoneButtonLabel(zone);
  const buttonLabelSize = buttonLabel.length > 8
    ? "text-2xl md:text-3xl"
    : buttonLabel.length > 4
      ? "text-3xl md:text-4xl"
      : "text-4xl md:text-5xl";

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl border-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${theme.wrap}`}>
      <div className={`px-5 pb-5 pt-4 ${theme.header}`}>
        <span className={`text-xl font-bold uppercase tracking-widest opacity-80 md:text-2xl ${theme.headerText}`}>
          {t("โซน", "Zone")}
        </span>
        <span className={`mt-1 block break-words font-black leading-none ${buttonLabelSize} ${theme.headerText}`}>
          {buttonLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <span className="text-xl font-bold leading-tight text-slate-700">{zone.name}</span>
        <span className={`mt-3 text-3xl font-black ${theme.price}`}>
          {(zone.price / 100).toLocaleString(numberLocale)}
          <span className="ml-1 text-base font-medium text-slate-500">{t("บาท", "THB")}</span>
        </span>
        <span className="mt-3 text-xl font-semibold leading-tight text-slate-500 md:text-2xl">
          {t("คงเหลือ", "Remaining")} {zone.remaining.toLocaleString(numberLocale)} {t("ที่นั่ง", "seats")}
        </span>
        <span className="mt-1 text-base font-medium text-slate-500 md:text-lg">
          {t("จาก", "of")} {zone.capacity.toLocaleString(numberLocale)} {t("ที่นั่ง", "seats")}
        </span>
      </div>
    </div>
  );
}

function getDynamicZoneTheme(zone: Pick<DynamicTicketZone, "code" | "name">): DynamicZoneTheme {
  const identity = `${zone.code} ${zone.name}`.toUpperCase();

  if (identity.includes("VVIP")) {
    return {
      wrap: "border-slate-900 bg-amber-50/50",
      header: "bg-slate-900",
      headerText: "text-[#E6BD3A]",
      price: "text-amber-700",
    };
  }

  if (identity.includes("VIP-A") || identity.includes("VIP-B") || /(?:ZONE|โซน)\s*[AB]\s*170/.test(identity)) {
    return {
      wrap: "border-[#B9983E] bg-amber-50/60",
      header: "bg-[#B9983E]",
      headerText: "text-slate-950",
      price: "text-[#8A6818]",
    };
  }

  return {
    wrap: "border-violet-500 bg-violet-50/60",
    header: "bg-violet-700",
    headerText: "text-white",
    price: "text-violet-700",
  };
}
