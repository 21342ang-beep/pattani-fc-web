import Image from "next/image";

type MainboardMedia = {
  url?: string | null;
  mimeType?: string | null;
} | null;

export default function HomeHero({
  type,
  image,
  video,
}: {
  type?: "image" | "video";
  image?: MainboardMedia;
  video?: MainboardMedia;
}) {
  const videoUrl = type === "video" ? video?.url ?? undefined : undefined;
  const showVideo = Boolean(videoUrl);
  const imageUrl = image?.url || "/home-hero-bg-team-collage.png";

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
      ) : (
        <Image
          src={imageUrl}
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
