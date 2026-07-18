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
  type,
  image,
  images,
  video,
}: {
  type?: "image" | "video";
  image?: MainboardMedia;
  images?: MainboardMedia[];
  video?: MainboardMedia;
}) {
  const videoUrl = type === "video" ? localMediaPath(video?.url) : undefined;
  const showVideo = Boolean(videoUrl);
  const imageUrl = localMediaPath(image?.url) || "/home-hero-bg-team-collage.png";
  const slides = (images ?? [])
    .map((item) => ({ url: localMediaPath(item?.url), alt: null }))
    .filter((item): item is { url: string; alt: null } => Boolean(item.url));

  return (
    <section className="relative isolate overflow-hidden bg-green-950">
      {showVideo ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="pointer-events-none mx-auto aspect-[1584/672] w-full object-cover"
        >
          <source src={videoUrl} type={video?.mimeType || undefined} />
        </video>
      ) : slides.length > 1 ? (
        <HomeHeroCarousel slides={slides} />
      ) : (
        <Image
          src={slides[0]?.url ?? imageUrl}
          alt=""
          width={1584}
          height={672}
          priority
          sizes="100vw"
          className="pointer-events-none mx-auto h-auto w-full"
        />
      )}
    </section>
  );
}
