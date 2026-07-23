import Link from "next/link";
import Image from "next/image";
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
import { readCustomerSession } from "@/lib/customer-session";
import {
  SEASON_MATCHES,
  SEASON_TIERS,
  type SeasonTier,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";

export const metadata = { title: "ตั๋วรายปี — Pattani FC" };

// icon แยกจากข้อมูลใน lib/season-pass-tiers.ts (lib ต้อง import ได้จากทั้ง server/client)
const TIER_ICONS: Record<SeasonTierId, React.ReactNode> = {
  "vvip-elite": <Crown className="size-9 md:size-10" />,
  "vip-advanced": <Star className="size-9 md:size-10" />,
  premium: <Award className="size-9 md:size-10" />,
  gold: <Medal className="size-9 md:size-10" />,
};

export default async function SeasonTicketsPage() {
  const session = await readCustomerSession();
  return (
    <>
      <PageHero
        title="ตั๋วรายปี"
        subtitle="บัตรสมาชิกรายปี — ซื้อครั้งเดียว ดูทุกแมตช์เหย้าตลอดฤดูกาล พร้อมสิทธิพิเศษเฉพาะสมาชิก"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <section className="mb-12">
          <div className="mb-7 text-center">
            <p className="text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl lg:text-2xl">Rainbow Stadium</p>
            <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">แผนผังสนาม</h2>
            <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">ตรวจสอบโซนที่นั่งก่อนเลือกแพ็กเกจสมาชิก</p>
          </div>
          <div className="relative aspect-[1553/1053] w-full">
              <Image
                src="/stadium-zones-season-2026-27.png"
                alt="แผนผังโซนที่นั่ง Rainbow Stadium — Pattani FC"
                fill
                sizes="(max-width: 768px) 100vw, 1152px"
                className="object-contain"
                priority
              />
          </div>
        </section>

        <div className="mb-10 text-center md:mb-12">
          <p className="inline-flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl">
            <CalendarRange className="size-5" />
            บัตรสมาชิกรายปี
          </p>
          <h2 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">
            เลือกแพ็กเกจสมาชิกของคุณ
          </h2>
          <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">
            ซื้อครั้งเดียว · ดู {SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SEASON_TIERS.filter((t) => t.id !== "vvip-elite").map((t) => (
            <TierCard key={t.id} tier={t} isMember={!!session} />
          ))}
        </div>

        <p className="mt-8 text-center text-lg leading-relaxed text-slate-500 md:text-xl lg:text-2xl">
          * บัตรสมาชิกรายปีครอบคลุมเฉพาะแมตช์เหย้าในฤดูกาลปัจจุบัน — ไม่รวมเกมนัดพิเศษ/ทัวร์นาเมนต์นานาชาติ
        </p>
      </div>
    </>
  );
}

function TierCard({ tier, isMember }: { tier: SeasonTier; isMember: boolean }) {
  const highlighted = tier.highlight;
  const priceLabel = tier.priceBaht.toLocaleString("th-TH");
  const unitLabel = `บาท / ฤดูกาล · ${SEASON_MATCHES} แมตช์`;
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
            <Sparkles className="size-4" /> {tier.ribbon}
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
        {tier.tagline}
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
        {tier.benefits.map((b) => (
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

      <Link
        href={isMember ? `/season-pass/apply?tier=${tier.id}` : `/register?next=${encodeURIComponent(`/season-pass/apply?tier=${tier.id}`)}`}
        className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-lg font-bold transition md:py-4 md:text-xl ${
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
