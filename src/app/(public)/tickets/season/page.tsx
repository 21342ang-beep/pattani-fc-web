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
import {
  SEASON_MATCHES,
  SEASON_TIERS,
  type SeasonTier,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";

export const metadata = { title: "ตั๋วรายปี — Pattani FC" };

// icon แยกจากข้อมูลใน lib/season-pass-tiers.ts (lib ต้อง import ได้จากทั้ง server/client)
const TIER_ICONS: Record<SeasonTierId, React.ReactNode> = {
  "vvip-elite": <Crown className="size-7" />,
  "vip-advanced": <Star className="size-7" />,
  premium: <Award className="size-7" />,
  gold: <Medal className="size-7" />,
};

export default function SeasonTicketsPage() {
  return (
    <>
      <PageHero
        title="ตั๋วรายปี"
        subtitle="บัตรสมาชิกรายปี — ซื้อครั้งเดียว ดูทุกแมตช์เหย้าตลอดฤดูกาล พร้อมสิทธิพิเศษเฉพาะสมาชิก"
      />

      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SEASON_TIERS.filter((t) => t.id !== "vvip-elite").map((t) => (
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
