import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { payload } from "@/lib/payload";
import HomeHero from "./_components/HomeHero";
import StatsRow from "./_components/StatsRow";
import FeaturedMatches from "./_components/FeaturedMatches";
import OnSaleMatchBoard from "./_components/OnSaleMatchBoard";

export const revalidate = 60;

export default async function HomePage() {
  const cms = await payload();
  const [featured, onSaleMatches, bookingSummary, homePage] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: ["SCHEDULED", "ON_SALE"] } },
      orderBy: { kickoffAt: "asc" },
      take: 4,
    }),
    prisma.match.findMany({ where: { status: "ON_SALE" }, orderBy: { kickoffAt: "asc" } }),
    prisma.booking.aggregate({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        match: { status: "ON_SALE" },
      },
      _sum: { quantity: true },
    }),
    cms.findGlobal({ slug: "home-page", overrideAccess: true }),
  ]);
  const totalBooked = bookingSummary._sum.quantity ?? 0;
  const totalAvailable = onSaleMatches.reduce((sum, match) => {
    const zoneCapacity =
      (match.zone170Seats ?? 0) +
      (match.zone150Seats ?? 0) +
      (match.zone120Seats ?? 0) +
      (match.zone100Seats ?? 0) +
      (match.zoneAwaySeats ?? 0);
    return sum + (match.totalSeats ?? zoneCapacity);
  }, 0);
  const totalRemaining = Math.max(0, totalAvailable - totalBooked);

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

      <div className="mx-auto w-full max-w-5xl space-y-14 px-5 py-14 md:px-8 md:py-20">
        <section>
          {onSaleMatches.length > 0 && (
            <div className="mb-10 space-y-4">
              <SectionHeader eyebrow="Book now" title="โปรแกรมที่เปิดจอง" subtitle="เลือกแมตช์และจองตั๋วได้ทันที" />
              {onSaleMatches.map((match) => <OnSaleMatchBoard key={match.id} match={match} />)}
            </div>
          )}
          <SectionHeader
            eyebrow="ทางลัด"
            title="ค้นพบสโมสร"
            subtitle="เข้าถึงทุกข้อมูลเกี่ยวกับปัตตานี เอฟซีได้ในที่เดียว"
          />
        </section>

        <section>
          <SectionHeader
            eyebrow="ระบบจองตั๋ว"
            title="ภาพรวมการจอง"
            subtitle="ยอดรวมของแมตช์ที่เปิดจอง"
          />
          <StatsRow
            stats={[
              {
                label: "จำนวนการจอง",
                value: totalBooked.toLocaleString("th-TH"),
                highlight: true,
              },
              { label: "คงเหลือ", value: totalRemaining.toLocaleString("th-TH") },
            ]}
          />
        </section>

        <section>
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-yellow-600">
                Next matches
              </p>
              <h2 className="mt-1.5 text-4xl font-black text-green-900 md:text-5xl">
                แมตช์ที่กำลังจะมาถึง
              </h2>
              <p className="mt-2 text-base text-muted-foreground">
                เลือกแมตช์ที่ต้องการ แล้วจองที่นั่งของคุณ
              </p>
            </div>
            <Link
              href="/matches"
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-green-200 px-5 py-2.5 text-base font-medium text-green-800 transition-all hover:bg-green-800 hover:text-yellow-300 sm:inline-flex"
            >
              ดูทั้งหมด <ArrowRight className="size-5" />
            </Link>
          </div>
          <FeaturedMatches matches={featured} />
          <Link
            href="/squad"
            className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-green-100 bg-green-950 px-5 py-4 text-yellow-100 transition hover:-translate-y-0.5 hover:bg-green-900 hover:shadow-lg"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-yellow-300 text-green-950"><Users className="size-6" /></span>
              <span><span className="block text-lg font-bold">ผู้เล่น</span><span className="text-sm text-yellow-100/70">นักเตะชุดใหญ่</span></span>
            </span>
            <ArrowRight className="size-5" />
          </Link>
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
      <p className="text-sm font-bold uppercase tracking-widest text-yellow-600">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-4xl font-black text-green-900 md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
