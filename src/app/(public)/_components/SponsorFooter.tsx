import Image from "next/image";

type SponsorRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const IMAGE_WIDTH = 1000;
const IMAGE_HEIGHT = 326;
const SPONSOR_IMAGE = "/sponsors-pattani-fc-2026-v2.png";

// Each box is measured against the visible pixels in the supplied artwork. Keeping the
// padding small means the hover treatment hugs the logo instead of a generic grid cell.
const sponsorRegions: SponsorRegion[] = [
  { x: 26, y: 37, width: 108, height: 43 },
  { x: 172, y: 27, width: 52, height: 63 },
  { x: 262, y: 27, width: 74, height: 63 },
  { x: 366, y: 27, width: 67, height: 63 },
  { x: 471, y: 27, width: 56, height: 63 },
  { x: 564, y: 27, width: 70, height: 63 },
  { x: 670, y: 27, width: 59, height: 63 },
  { x: 771, y: 27, width: 59, height: 63 },
  { x: 868, y: 34, width: 102, height: 52 },
  { x: 128, y: 120, width: 162, height: 32 },
  { x: 313, y: 113, width: 97, height: 50 },
  { x: 439, y: 124, width: 119, height: 27 },
  { x: 585, y: 116, width: 111, height: 44 },
  { x: 712, y: 128, width: 162, height: 18 },
  { x: 163, y: 188, width: 60, height: 49 },
  { x: 256, y: 185, width: 52, height: 55 },
  { x: 342, y: 198, width: 96, height: 24 },
  { x: 461, y: 189, width: 77, height: 40 },
  { x: 570, y: 202, width: 80, height: 23 },
  { x: 693, y: 185, width: 50, height: 54 },
  { x: 779, y: 188, width: 58, height: 49 },
  { x: 9, y: 268, width: 139, height: 17 },
  { x: 169, y: 255, width: 39, height: 42 },
  { x: 229, y: 256, width: 49, height: 41 },
  { x: 293, y: 257, width: 54, height: 39 },
  { x: 361, y: 256, width: 47, height: 41 },
  { x: 426, y: 256, width: 53, height: 41 },
  { x: 498, y: 255, width: 44, height: 41 },
  { x: 562, y: 255, width: 43, height: 42 },
  { x: 623, y: 260, width: 59, height: 33 },
  { x: 688, y: 260, width: 56, height: 32 },
  { x: 759, y: 256, width: 49, height: 41 },
  { x: 826, y: 255, width: 51, height: 41 },
  { x: 893, y: 268, width: 96, height: 16 },
];

export default function SponsorFooter() {
  return (
    <section className="border-b border-green-100 bg-white py-9 sm:py-12" aria-label="Official Partners">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative aspect-[1000/326] w-full">
          <Image
            src={SPONSOR_IMAGE}
            alt="ผู้สนับสนุน Pattani FC"
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            sizes="(max-width: 1280px) 100vw, 1152px"
            className="size-full"
          />
          {sponsorRegions.map((region, index) => (
            <span
              key={`${region.x}-${region.y}`}
              role="img"
              aria-label={`ผู้สนับสนุนรายที่ ${index + 1}`}
              className="absolute cursor-default transition duration-200 ease-out hover:z-10 hover:scale-110 hover:shadow-[0_4px_9px_rgba(2,44,34,0.16)]"
              style={{
                left: `${(region.x / IMAGE_WIDTH) * 100}%`,
                top: `${(region.y / IMAGE_HEIGHT) * 100}%`,
                width: `${(region.width / IMAGE_WIDTH) * 100}%`,
                height: `${(region.height / IMAGE_HEIGHT) * 100}%`,
                backgroundImage: `url(${SPONSOR_IMAGE})`,
                backgroundSize: `${(IMAGE_WIDTH / region.width) * 100}% auto`,
                backgroundPosition: `${(region.x / (IMAGE_WIDTH - region.width)) * 100}% ${(region.y / (IMAGE_HEIGHT - region.height)) * 100}%`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
