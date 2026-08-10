import Image from "next/image";
import HomeHeroCarousel from "./HomeHeroCarousel";

type MainboardMedia = {
  url?: string | null;
  mimeType?: string | null;
} | null;

function localMediaPath(url?: string | null) {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/payload-api/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // URLs that are already paths can be used as-is.
  }

  return url;
}

export default function HomeHero({
  slides,
}: {
  slides?: MainboardMedia[];
}) {
  const mediaSlides = (slides ?? [])
    .map((item) => ({
      url: localMediaPath(item?.url),
      mimeType: item?.mimeType,
    }))
    .filter(
      (item): item is { url: string; mimeType: string | null | undefined } =>
        Boolean(item.url),
    );

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-green-950">
      {mediaSlides.length > 0 ? (
        <HomeHeroCarousel slides={mediaSlides} />
      ) : (
        <Image
          src="/home-hero-bg-team-collage.png"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="pointer-events-none object-cover"
        />
      )}
    </section>
  );
}
