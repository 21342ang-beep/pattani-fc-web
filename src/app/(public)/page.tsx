import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { payload } from "@/lib/payload";
import HomeHero from "./_components/HomeHero";
import StatsRow from "./_components/StatsRow";
import FeaturedMatches from "./_components/FeaturedMatches";
import OnSaleMatchBoard from "./_components/OnSaleMatchBoard";
import HomePlayers, { type HomePlayer } from "./_components/HomePlayers";
import HomeZoneAvailability from "./_components/HomeZoneAvailability";
import { getT } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/text";
import {
  aggregateZoneAvailability,
  getSeatAvailabilityForMatches,
  summarizeSeatAvailability,
} from "@/lib/seat-availability";

export const revalidate = 60;

export default async function HomePage() {
  const cms = await payload();
  const [featured, onSaleMatches, homePage, playersResult, { locale, dict }] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: { in: ["SCHEDULED", "ON_SALE"] },
        OR: [
          { homeTeam: { contains: "Pattani", mode: "insensitive" } },
          { homeTeam: { contains: "ปัตตานี" } },
          { awayTeam: { contains: "Pattani", mode: "insensitive" } },
          { awayTeam: { contains: "ปัตตานี" } },
        ],
      },
      orderBy: { kickoffAt: "asc" },
      take: 4,
    }),
    prisma.match.findMany({ where: { status: "ON_SALE" }, orderBy: { kickoffAt: "asc" } }),
    cms.findGlobal({ slug: "home-page", overrideAccess: true }),
    cms.find({
      collection: "players",
      where: { active: { equals: true } },
      sort: "jerseyNumber",
      // ส่งผู้เล่นทุกคนให้ carousel แบ่งเป็นชุดละ 4 ใบและเลื่อนต่อเนื่อง
      limit: 100,
      depth: 1,
      overrideAccess: true,
    }),
    getT(),
  ]);
  const numberLocale = intlLocale(locale);
  const availabilityByMatch = await getSeatAvailabilityForMatches(onSaleMatches);
  const availabilityByZone = aggregateZoneAvailability(availabilityByMatch);
  const seatSummary = summarizeSeatAvailability(availabilityByMatch);
  const totalReserved = seatSummary.matchBooked;
  const homePlayers = playersResult.docs as unknown as HomePlayer[];

  return (
    <div className="bg-white">
      <HomeHero
        slides={
          Array.isArray(homePage.mainboardSlides)
            ? homePage.mainboardSlides.filter(
                (media): media is { url?: string | null; mimeType?: string | null } =>
                  typeof media === "object" && media !== null,
              )
            : []
        }
      />

      <div className="mx-auto w-full max-w-6xl space-y-14 px-5 py-14 md:px-8 md:py-20">
        <section>
          {onSaleMatches.length > 0 && (
            <div className="mb-10 space-y-4">
              <SectionHeader eyebrow={dict.home.bookNowEyebrow} title={dict.home.onSaleTitle} subtitle={dict.home.onSaleSubtitle} />
              {onSaleMatches.map((match) => (
                <OnSaleMatchBoard
                  key={match.id}
                  match={match}
                  locale={locale}
                  labels={dict.home}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            eyebrow={dict.home.bookingEyebrow}
            title={dict.home.bookingTitle}
            subtitle={dict.home.bookingSubtitle}
          />
          <StatsRow
            stats={[
              {
                label: dict.home.matchBooked,
                value: totalReserved.toLocaleString(numberLocale),
                highlight: true,
              },
              { label: dict.home.remaining, value: seatSummary.remaining.toLocaleString(numberLocale) },
            ]}
          />
          <HomeZoneAvailability availability={availabilityByZone} locale={locale} labels={dict.home} />
        </section>

        <HomePlayers players={homePlayers} labels={dict.home} />

        <section>
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-base font-bold uppercase tracking-widest text-yellow-600 sm:text-lg">
                {dict.home.nextMatchesEyebrow}
              </p>
              <h2 className="mt-1.5 text-5xl font-black text-green-900 sm:text-6xl lg:text-7xl">
                {dict.home.nextMatchesTitle}
              </h2>
              <p className="mt-2 text-lg text-muted-foreground sm:text-xl lg:text-2xl">
                {dict.home.nextMatchesSubtitle}
              </p>
            </div>
            <Link
              href="/matches"
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-green-200 px-5 py-2.5 text-base font-medium text-green-800 transition-all hover:bg-green-800 hover:text-yellow-300 sm:inline-flex sm:text-lg"
            >
              {dict.home.viewAll} <ArrowRight className="size-5" />
            </Link>
          </div>
          <FeaturedMatches matches={featured} locale={locale} labels={dict.home} />
        </section>

      </div>

    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-base font-bold uppercase tracking-widest text-yellow-600 sm:text-lg">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-5xl font-black text-green-900 sm:text-6xl lg:text-7xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-lg text-muted-foreground sm:text-xl">{subtitle}</p>
      )}
    </div>
  );
}
