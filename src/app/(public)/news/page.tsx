import Image from "next/image";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { payload } from "@/lib/payload";
import { formatDateTime } from "@/lib/format";
import PageHero from "../_components/PageHero";
import { resolveCover, type NewsDoc } from "./_helpers";

export const revalidate = 300;
export const metadata = { title: "ข่าวสาร — Pattani FC" };

export default async function NewsPage() {
  const cms = await payload();
  const { docs } = await cms.find({
    collection: "news",
    where: { status: { equals: "published" } },
    sort: "-publishedAt",
    limit: 24,
    depth: 1,
    overrideAccess: true,
  });

  return (
    <>
      <PageHero
        title="ข่าวสาร"
        subtitle="ข่าวสารและความเคลื่อนไหวล่าสุดของสโมสรปัตตานี เอฟซี"
      />
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        {docs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-lg text-muted-foreground md:text-xl">
              ยังไม่มีข่าวสารที่เผยแพร่
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((n) => {
              const item = n as unknown as NewsDoc;
              const coverSrc = resolveCover(item);
              return (
                <li key={item.id}>
                  <Card className="group h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    {coverSrc ? (
                      <div className="relative aspect-video overflow-hidden bg-green-100">
                        <Image
                          src={coverSrc}
                          alt={item.title}
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-green-800 to-green-950" />
                    )}
                    <CardContent className="space-y-3 p-6 md:p-7">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground md:text-base">
                        <Calendar className="size-4" />
                        {item.publishedAt
                          ? formatDateTime(item.publishedAt)
                          : "ยังไม่ระบุวันที่"}
                      </div>
                      <h3 className="line-clamp-2 text-xl font-semibold leading-snug text-green-900 md:text-2xl">
                        {item.title}
                      </h3>
                      {item.summary && (
                        <p className="line-clamp-3 text-base leading-relaxed text-muted-foreground md:text-lg">
                          {item.summary}
                        </p>
                      )}
                      <Link
                        href={`/news/${encodeURIComponent(item.slug)}`}
                        className="inline-flex pt-1 text-base font-medium text-green-800 hover:underline md:text-lg"
                      >
                        อ่านต่อ →
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
