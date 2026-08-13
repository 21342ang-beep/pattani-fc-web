import Image from "next/image";
import Link from "next/link";
import {
  Crown,
  Star,
  Award,
  Medal,
  Check,
  Sparkles,
  CalendarRange,
} from "lucide-react";
import PageHero from "../../_components/PageHero";
import SeasonPassAnnouncementModal from "../../_components/SeasonPassAnnouncementModal";
import StadiumModelViewer, { type StadiumModelZone } from "../_components/StadiumModelViewer";
import {
  SEASON_MATCHES,
  SEASON_TIERS,
  type SeasonTier,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import { getT } from "@/lib/i18n/server";
import { intlLocale, localize } from "@/lib/i18n/text";
import type { Locale } from "@/lib/i18n/dict";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";

export const metadata = { title: "ตั๋วรายปี — Pattani FC" };

// icon แยกจากข้อมูลใน lib/season-pass-tiers.ts (lib ต้อง import ได้จากทั้ง server/client)
const TIER_ICONS: Record<SeasonTierId, React.ReactNode> = {
  "vvip-elite": <Crown className="size-9 md:size-10" />,
  "vip-advanced": <Star className="size-9 md:size-10" />,
  premium: <Award className="size-9 md:size-10" />,
  gold: <Medal className="size-9 md:size-10" />,
};

const TIER_MOCKUPS: Partial<Record<SeasonTierId, string>> = {
  "vip-advanced": "/season-pass-vip-mockup.png",
  premium: "/season-pass-premium-mockup-v2.png",
  gold: "/season-pass-gold-mockup.png",
};

export default async function SeasonTicketsPage() {
  const [{ locale }, purchaseSettings] = await Promise.all([
    getT(),
    getTicketPurchaseSettings(),
  ]);
  const t = (th: string, en: string) => localize(locale, th, en);
  const seasonModelZones: StadiumModelZone[] = [
    { code: "A", tierId: "premium" as const, seatLabel: "A", gate: "A" },
    { code: "B", tierId: "premium" as const, seatLabel: "B", gate: "B" },
    { code: "F", tierId: "premium" as const, seatLabel: "F", gate: "F1 / F2" },
    { code: "C", tierId: "gold" as const, seatLabel: "C", gate: "C" },
    { code: "E", tierId: "gold" as const, seatLabel: "E", gate: "E" },
    { code: "G", tierId: "gold" as const, seatLabel: "G", gate: "G" },
    { code: "J", tierId: "gold" as const, seatLabel: "J", gate: "J" },
    { code: "VIP-A", tierId: "vip-advanced" as const, seatLabel: "A", gate: "A" },
    { code: "VIP-B", tierId: "vip-advanced" as const, seatLabel: "B", gate: "B" },
  ].map(({ code, tierId, seatLabel, gate }) => {
    const tier = SEASON_TIERS.find((candidate) => candidate.id === tierId)!;
    const translatedTier = locale === "ms" ? seasonTierMalay(tier.id) : seasonTierEnglish(tier.id);
    const zoneWord = locale === "th" ? "โซน" : locale === "ms" ? "Zon" : "Zone";
    const seasonUnit = locale === "th" ? "บาท / ฤดูกาล" : locale === "ms" ? "THB / musim" : "THB / season";
    const matchDetail = locale === "th"
      ? `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`
      : locale === "ms"
        ? `${SEASON_MATCHES} perlawanan di tempat sendiri sepanjang musim`
        : `${SEASON_MATCHES} home matches throughout the season`;
    return {
      code,
      label: `${zoneWord} ${tier.badge} · ${seatLabel}`,
      priceLabel: `${tier.priceBaht.toLocaleString(intlLocale(locale))} ${seasonUnit}`,
      availabilityLabel: matchDetail,
      details: [
        locale === "th" ? `แพ็กเกจ ${tier.badge}` : locale === "ms" ? `Pakej ${tier.badge}` : `${tier.badge} package`,
        locale === "th" ? `ทางเข้า Gate ${gate}` : locale === "ms" ? `Pintu masuk Gate ${gate}` : `Entrance Gate ${gate}`,
      ],
      note: locale === "th" ? tier.tagline : translatedTier.tagline,
    };
  });
  return (
    <>
      <SeasonPassAnnouncementModal initiallyOpen={!purchaseSettings.seasonPassBookingOpen} />

      <PageHero
        title={t("ตั๋วรายปี", "Season Tickets")}
        subtitle={t("บัตรสมาชิกรายปี — ซื้อครั้งเดียว ดูทุกแมตช์เหย้าตลอดฤดูกาล พร้อมสิทธิพิเศษเฉพาะสมาชิก", "One season pass for every home match, with exclusive member benefits")}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <section className="mb-12">
          <div className="mb-7 text-center">
            <p className="text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl lg:text-2xl">Rainbow Stadium</p>
            <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">
              {t("สนามแบบ 3 มิติ", "3D Stadium")}
            </h2>
            <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">{t("ตรวจสอบโซนที่นั่งก่อนเลือกแพ็กเกจสมาชิก", "Review seating zones before choosing your membership package")}</p>
          </div>
          <StadiumModelViewer
            title={t("สนามปัตตานีแบบ 3 มิติ", "Pattani Stadium in 3D")}
            description={t("สำรวจสนามแบบรอบทิศก่อนเลือกแพ็กเกจและโซนรายปี", "Explore the stadium before choosing your season package and zone")}
            loadingLabel={t("กำลังโหลดโมเดลสนาม", "Loading stadium model")}
            errorLabel={t("อุปกรณ์นี้ไม่สามารถแสดงโมเดล 3 มิติได้", "This device cannot display the 3D model.")}
            interactionLabel={t("ลากเพื่อหมุน · เลื่อนเพื่อซูม", "Drag to rotate · Scroll to zoom")}
            labelModelSrc="/models/pattani-stadium-labels-season.glb?v=20260812-3"
            plainBackground
            zones={seasonModelZones}
            zoneHintLabel={t("ชี้หรือแตะโซนเพื่อดูราคาและรายละเอียดรายปี", "Hover or tap a zone to see season price and details")}
          />
        </section>

        <div className="mb-10 text-center md:mb-12">
          <p className="inline-flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl">
            <CalendarRange className="size-5" />
            {t("บัตรสมาชิกรายปี", "Season Membership")}
          </p>
          <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">
            {t("เลือกแพ็กเกจสมาชิกของคุณ", "Choose Your Membership Package")}
          </h2>
          <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">
            {t("ซื้อครั้งเดียว · ดู", "One purchase · Watch all")} {SEASON_MATCHES} {t("แมตช์เหย้าตลอดฤดูกาล", "home matches this season")}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SEASON_TIERS.filter((t) => t.id !== "vvip-elite").map((t) => (
            <TierCard
              key={t.id}
              tier={t}
              locale={locale}
              bookingOpen={purchaseSettings.seasonPassBookingOpen}
            />
          ))}
        </div>

        <figure className="mx-auto mb-10 mt-10 w-full max-w-5xl md:mb-12 md:mt-12">
          <Image
            src="/stadium-zones-season-2026-27-v5.png"
            alt={t("แผนผังโซนที่นั่งและราคาบัตรสมาชิกรายปี", "Season membership seating zones and prices")}
            width={1553}
            height={1058}
            sizes="(min-width: 1280px) 1024px, (min-width: 768px) calc(100vw - 4rem), calc(100vw - 2rem)"
            className="h-auto w-full object-contain"
          />
        </figure>

        <p className="mt-8 text-center text-lg leading-relaxed text-slate-500 md:text-xl lg:text-2xl">
          {t("* บัตรสมาชิกรายปีครอบคลุมเฉพาะแมตช์เหย้าในฤดูกาลปัจจุบัน — ไม่รวมเกมนัดพิเศษ/ทัวร์นาเมนต์นานาชาติ", "* Season passes cover current-season home matches only and exclude special matches and international tournaments.")}
        </p>
      </div>
    </>
  );
}

function TierCard({
  tier,
  locale,
  bookingOpen,
}: {
  tier: SeasonTier;
  locale: Locale;
  bookingOpen: boolean;
}) {
  const t = (th: string, en: string) => localize(locale, th, en);
  const highlighted = tier.highlight;
  const priceLabel = tier.priceBaht.toLocaleString(intlLocale(locale));
  const unitLabel = `${t("บาท / ฤดูกาล", "THB / season")} · ${SEASON_MATCHES} ${t("แมตช์", "matches")}`;
  const tierCopy = locale === "ms" ? seasonTierMalay(tier.id) : seasonTierEnglish(tier.id);
  const mockup = TIER_MOCKUPS[tier.id];
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-3xl border-2 p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl md:p-8 lg:p-9 ${
        highlighted
          ? "border-yellow-400 bg-gradient-to-b from-green-900 to-green-950 text-yellow-100 shadow-yellow-400/10"
          : "border-green-100 bg-white"
      }`}
    >
      {tier.ribbon && (
        <div className="absolute right-0 top-6 rounded-l-full bg-yellow-400 px-5 py-2 text-sm font-bold text-green-950 shadow md:text-base">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-4" /> {locale === "th" ? tier.ribbon : tierCopy.ribbon}
          </span>
        </div>
      )}

      <div
        className={`mb-5 inline-flex size-16 items-center justify-center rounded-2xl md:size-20 ${
          highlighted
            ? "bg-yellow-400 text-green-950"
            : "bg-green-100 text-green-800"
        }`}
      >
        {TIER_ICONS[tier.id]}
      </div>

      {mockup && (
        <div
          className={`mb-6 overflow-hidden rounded-2xl border ${
            highlighted ? "border-yellow-300/30 bg-white" : "border-green-100 bg-white"
          }`}
        >
          <Image
            src={mockup}
            alt={`${t("ภาพตัวอย่างบัตรสมาชิก", "Membership card preview")} ${tier.name} Pattani FC`}
            width={1600}
            height={1600}
            sizes="(max-width: 640px) calc(100vw - 4rem), (max-width: 1024px) calc(50vw - 3rem), 360px"
            className="aspect-square w-full object-cover"
          />
        </div>
      )}

      <p
        className={`text-sm font-bold uppercase tracking-widest md:text-base ${
          highlighted ? "text-yellow-300/80" : "text-yellow-600"
        }`}
      >
        {tier.badge}
      </p>
      <h3
        className={`mt-2 text-3xl font-black md:text-4xl ${
          highlighted ? "text-yellow-300" : "text-green-900"
        }`}
      >
        {tier.name}
      </h3>
      <p
        className={`mt-2 text-lg leading-relaxed md:text-xl ${
          highlighted ? "text-yellow-100/80" : "text-slate-600"
        }`}
      >
        {locale === "th" ? tier.tagline : tierCopy.tagline}
      </p>
      <p
        className={`mt-3 text-base font-semibold md:text-lg ${
          highlighted ? "text-yellow-200" : "text-green-800"
        }`}
      >
        {t("โซนที่เลือกได้:", "Available zones:")} {tier.allowedSeatZones.join(" · ")}
      </p>

      <div
        className={`mt-6 border-y py-5 ${
          highlighted ? "border-yellow-300/20" : "border-green-100"
        }`}
      >
        <div className="flex items-baseline gap-2">
          <span
            className={`text-5xl font-black md:text-6xl ${
              highlighted ? "text-yellow-300" : "text-green-900"
            }`}
          >
            {priceLabel}
          </span>
          <span
            className={`text-base md:text-lg ${
              highlighted ? "text-yellow-100/70" : "text-slate-500"
            }`}
          >
            {unitLabel}
          </span>
        </div>
      </div>

      <ul className="mt-6 flex-1 space-y-3.5">
        {(locale === "th" ? tier.benefits : tierCopy.benefits).map((b) => (
          <li key={b} className="flex items-start gap-3 text-base leading-relaxed md:text-lg">
            <Check
              className={`mt-1 size-5 shrink-0 ${
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

      {bookingOpen ? (
        <Link
          href={`/tickets/season/apply?tier=${tier.id}`}
          className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-lg font-bold transition md:py-4 md:text-xl ${
            highlighted
              ? "bg-yellow-400 text-green-950 hover:bg-yellow-300"
              : "bg-green-800 text-yellow-300 hover:bg-green-900"
          }`}
        >
          {t("ซื้อบัตรสมาชิกรายปี", "Buy Season Membership")}
        </Link>
      ) : (
        <SeasonPassAnnouncementModal
          className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-lg font-bold transition md:py-4 md:text-xl ${
            highlighted
              ? "bg-yellow-400 text-green-950 hover:bg-yellow-300"
              : "bg-green-800 text-yellow-300 hover:bg-green-900"
          }`}
        >
          {t("ซื้อบัตรสมาชิกรายปี", "Buy Season Membership")}
        </SeasonPassAnnouncementModal>
      )}
    </div>
  );
}

function seasonTierEnglish(id: SeasonTierId) {
  const shared = [`Admission to all ${SEASON_MATCHES} home matches`, "Eligible for club souvenir prize draws"];
  const tiers: Record<SeasonTierId, { tagline: string; ribbon?: string; benefits: string[] }> = {
    "vvip-elite": { tagline: "Club-president level experience", ribbon: "Most exclusive", benefits: [shared[0], "VVIP membership card and assigned seat", "One official home jersey", "Card and jersey delivered within 2–3 days", shared[1]] },
    "vip-advanced": { tagline: "Covered VIP stand with comfortable seating", ribbon: "Most popular · Best value", benefits: [shared[0], "VIP membership card and assigned VIP-zone seat", "One official home jersey", "Card and jersey collection details will be announced by the club", shared[1]] },
    premium: { tagline: "Premium zone with a lively atmosphere", benefits: [shared[0], "Annual Premium membership card", shared[1]] },
    gold: { tagline: "The starting point for true supporters", benefits: [shared[0], "Annual Gold membership card", shared[1]] },
  };
  return tiers[id];
}

function seasonTierMalay(id: SeasonTierId) {
  const shared = [`Kemasukan ke semua ${SEASON_MATCHES} perlawanan di tempat sendiri`, "Layak menyertai cabutan hadiah cenderamata kelab"];
  const tiers: Record<SeasonTierId, { tagline: string; ribbon?: string; benefits: string[] }> = {
    "vvip-elite": { tagline: "Pengalaman bertaraf presiden kelab", ribbon: "Paling eksklusif", benefits: [shared[0], "Kad keahlian VVIP dan tempat duduk tetap", "Satu jersi rasmi tempat sendiri", "Kad dan jersi dihantar dalam 2–3 hari", shared[1]] },
    "vip-advanced": { tagline: "Tempat duduk VIP berbumbung yang selesa", ribbon: "Paling popular · Nilai terbaik", benefits: [shared[0], "Kad keahlian VIP dan tempat duduk tetap zon VIP", "Satu jersi rasmi tempat sendiri", "Butiran pengambilan kad dan jersi akan diumumkan oleh kelab", shared[1]] },
    premium: { tagline: "Zon premium dengan suasana meriah", benefits: [shared[0], "Kad keahlian Premium tahunan", shared[1]] },
    gold: { tagline: "Permulaan untuk penyokong sejati", benefits: [shared[0], "Kad keahlian Gold tahunan", shared[1]] },
  };
  return tiers[id];
}
