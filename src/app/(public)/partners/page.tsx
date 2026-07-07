import Image from "next/image";
import Link from "next/link";
import { Handshake, ArrowRight } from "lucide-react";
import { payload } from "@/lib/payload";

export const revalidate = 300;
export const metadata = { title: "พาร์ทเนอร์ — Pattani FC" };

type SponsorDoc = {
  id: string | number;
  name: string;
  logoUrl?: string;
  website?: string;
  tier?: string;
};

type Tier = {
  key: string;
  label: string;
  thai: string;
  grid: string;
  cardClass: string;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    key: "title",
    label: "Title Sponsor",
    thai: "ผู้สนับสนุนหลัก",
    grid: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2",
    cardClass: "aspect-[16/9]",
    highlight: true,
  },
  {
    key: "main",
    label: "Main Sponsor",
    thai: "สปอนเซอร์หลัก",
    grid: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    cardClass: "aspect-[4/3]",
  },
  {
    key: "partner",
    label: "Supporting Sponsors",
    thai: "ผู้สนับสนุนร่วม",
    grid: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
    
    cardClass: "aspect-[4/3]",
  },
  {
    key: "supporter",
    label: "Supporter",
    thai: "ผู้สนับสนุน",
    grid: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
    cardClass: "aspect-square",
  },
];

export default async function PartnersPage() {
  const cms = await payload();
  const { docs } = await cms.find({
    collection: "sponsors",
    where: { active: { equals: true } },
    limit: 200,
    overrideAccess: true,
  });

  const sponsors = docs as unknown as SponsorDoc[];
  const grouped: Record<string, SponsorDoc[]> = {};
  for (const s of sponsors) {
    const tier = s.tier ?? "supporter";
    (grouped[tier] ||= []).push(s);
  }

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-950 text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(34,197,94,0.22),transparent_55%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-12 md:py-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-400/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-yellow-200 backdrop-blur-sm">
            <Handshake className="size-3.5" />
            ร่วมเดินทางกับเรา
          </p>
          <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">
            <span className="block">พาร์ทเนอร์</span>
            <span className="block bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
              ของสโมสร
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-green-100/85 md:text-xl">
            ขอบคุณผู้สนับสนุนและพันธมิตรทุกท่านที่อยู่เคียงข้างปัตตานี เอฟซี
            ในทุกเส้นทางสู่ความสำเร็จของฟุตบอลไทย
          </p>

          <div className="mt-7 flex flex-wrap gap-6 border-t border-yellow-300/20 pt-6">
            <Stat value={sponsors.length} label="พาร์ทเนอร์ทั้งหมด" />
            <Stat
              value={(grouped.title ?? []).length + (grouped.main ?? []).length}
              label="สปอนเซอร์หลัก"
            />
            <Stat value="2026/2027" label="ฤดูกาลปัจจุบัน" />
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="bg-slate-100 py-12 md:py-16">
        <div className="mx-auto max-w-7xl space-y-12 px-4">
          {sponsors.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <p className="text-lg text-slate-500">ยังไม่มีข้อมูลผู้สนับสนุน</p>
            </div>
          ) : (
            TIERS.map((t) => {
              const list = grouped[t.key];
              if (!list || list.length === 0) return null;
              return (
                <section key={t.key}>
                  <TierHeader label={t.label} thai={t.thai} count={list.length} />
                  <ul className={`mt-5 grid gap-4 ${t.grid}`}>
                    {list.map((s) => (
                      <li key={String(s.id)}>
                        <SponsorTile
                          sponsor={s}
                          aspectClass={t.cardClass}
                          highlight={t.highlight}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* CTA */}
      <section className="bg-green-950 py-14 text-yellow-100">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-300/80">
              สนใจเป็นพาร์ทเนอร์
            </p>
            <h3 className="mt-1.5 text-2xl font-black md:text-3xl">
              ร่วมเดินทางสู่ความสำเร็จไปกับ Pattani FC
            </h3>
            <p className="mt-2 max-w-2xl text-base text-green-100/80">
              เปิดรับผู้สนับสนุนทุกระดับ — Title / Main / Official Partner /
              Supporter พร้อมแพ็กเกจที่ตอบโจทย์ธุรกิจของคุณ
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3.5 text-base font-bold text-green-950 shadow-lg shadow-yellow-400/20 transition hover:scale-105 hover:bg-yellow-300"
          >
            ติดต่อทีมพาร์ทเนอร์ <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-black text-yellow-300 md:text-4xl">{value}</p>
      <p className="text-xs uppercase tracking-widest text-green-100/70">{label}</p>
    </div>
  );
}

function TierHeader({
  label,
  thai,
  count,
}: {
  label: string;
  thai: string;
  count: number;
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b-2 border-yellow-400/60 pb-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
          {label}
        </p>
        <h2 className="mt-1 text-2xl font-black text-green-900 md:text-3xl">
          {thai}
        </h2>
      </div>
      <span className="rounded-full bg-green-800 px-3 py-1 text-xs font-bold text-yellow-300">
        {count} ราย
      </span>
    </div>
  );
}

function SponsorTile({
  sponsor,
  aspectClass,
  highlight,
}: {
  sponsor: SponsorDoc;
  aspectClass: string;
  highlight?: boolean;
}) {
  const inner = (
    <div
      className={`group relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border bg-white p-4 transition-all hover:-translate-y-1 hover:shadow-xl ${
        highlight
          ? "border-yellow-400/70 shadow-md shadow-yellow-400/10 hover:shadow-yellow-400/30"
          : "border-slate-200 hover:border-green-300 hover:shadow-green-900/10"
      } ${aspectClass}`}
    >
      {/* corner accent — ของเรา ไม่เหมือนใคร */}
      <span
        aria-hidden
        className="absolute -right-6 -top-6 size-12 rotate-45 bg-yellow-400/0 transition group-hover:bg-yellow-400/20"
      />

      {sponsor.logoUrl ? (
        <div className="relative h-full w-full">
          <Image
            src={sponsor.logoUrl}
            alt={sponsor.name}
            fill
            unoptimized
            sizes="(min-width: 1024px) 14vw, (min-width: 640px) 25vw, 40vw"
            className="object-contain transition-transform group-hover:scale-105"
          />
        </div>
      ) : (
        <span className="text-center text-sm font-bold uppercase tracking-wide text-green-900 md:text-base">
          {sponsor.name}
        </span>
      )}
    </div>
  );

  if (sponsor.website) {
    return (
      <a
        href={sponsor.website}
        target="_blank"
        rel="noopener noreferrer"
        title={sponsor.name}
        className="block h-full"
      >
        {inner}
      </a>
    );
  }
  return <div title={sponsor.name}>{inner}</div>;
}
