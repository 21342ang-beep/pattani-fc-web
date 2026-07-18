import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { payload } from "@/lib/payload";
import HomeHero from "./_components/HomeHero";
import StatsRow from "./_components/StatsRow";
import FeaturedMatches from "./_components/FeaturedMatches";
import BentoQuickLinks from "./_components/BentoQuickLinks";
import OnSaleMatchBoard from "./_components/OnSaleMatchBoard";

export const revalidate = 60;

export default async function HomePage() {
  const cms = await payload();
  const [featured, onSaleMatches, totalMatches, totalOnSale, homePage] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: ["SCHEDULED", "ON_SALE"] } },
      orderBy: { kickoffAt: "asc" },
      take: 4,
    }),
    prisma.match.findMany({ where: { status: "ON_SALE" }, orderBy: { kickoffAt: "asc" } }),
    prisma.match.count(),
    prisma.match.count({ where: { status: "ON_SALE" } }),
    cms.findGlobal({ slug: "home-page", overrideAccess: true }),
  ]);

  return (
    <div className="bg-white">
      <HomeHero
        type={homePage.mainboardType as "image" | "video" | undefined}
        image={
          typeof homePage.mainboardImage === "object" && homePage.mainboardImage
            ? homePage.mainboardImage
            : null
        }
        images={
          Array.isArray(homePage.mainboardSlides)
            ? homePage.mainboardSlides.filter(
                (media): media is { url?: string | null; mimeType?: string | null } =>
                  typeof media === "object" && media !== null,
              )
            : []
        }
        video={
          typeof homePage.mainboardVideo === "object" && homePage.mainboardVideo
            ? homePage.mainboardVideo
            : null
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-14 px-5 py-14 md:px-8 md:py-20">
        <section>
          {false && onSaleMatches.length > 0 && (
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
          {onSaleMatches.length > 0 && (
            <div className="mb-4 space-y-4">
              {onSaleMatches.map((match) => <OnSaleMatchBoard key={match.id} match={match} />)}
            </div>
          )}
          <BentoQuickLinks onSaleMatch={onSaleMatches[0]} />
        </section>

        <section>
          <SectionHeader
            eyebrow="ตัวเลขในระบบ"
            title="ภาพรวมปัจจุบัน"
            subtitle="ข้อมูลแบบเรียลไทม์จากระบบจองตั๋ว"
          />
          <StatsRow
            stats={[
              { label: "แมตช์ทั้งหมด", value: totalMatches.toString() },
              {
                label: "กำลังเปิดจอง",
                value: totalOnSale.toString(),
                highlight: true,
              },
              { label: "ราคา", value: "เริ่ม 250฿" },
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
