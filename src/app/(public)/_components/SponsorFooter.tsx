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

// Bounding boxes follow the supplied sponsor artwork, so each logo can react independently.
const sponsorRegions: SponsorRegion[] = [
  { x: 18, y: 20, width: 110, height: 68 },
  { x: 160, y: 20, width: 76, height: 68 },
  { x: 258, y: 20, width: 82, height: 68 },
  { x: 365, y: 20, width: 76, height: 68 },
  { x: 465, y: 20, width: 84, height: 68 },
  { x: 568, y: 20, width: 86, height: 68 },
  { x: 674, y: 20, width: 86, height: 68 },
  { x: 770, y: 20, width: 86, height: 68 },
  { x: 870, y: 20, width: 116, height: 68 },
  { x: 120, y: 105, width: 190, height: 58 },
  { x: 330, y: 105, width: 92, height: 58 },
  { x: 438, y: 105, width: 132, height: 58 },
  { x: 585, y: 105, width: 116, height: 58 },
  { x: 710, y: 105, width: 166, height: 58 },
  { x: 155, y: 180, width: 82, height: 62 },
  { x: 245, y: 180, width: 76, height: 62 },
  { x: 335, y: 180, width: 108, height: 62 },
  { x: 460, y: 180, width: 80, height: 62 },
  { x: 560, y: 180, width: 90, height: 62 },
  { x: 680, y: 180, width: 76, height: 62 },
  { x: 770, y: 180, width: 82, height: 62 },
  { x: 0, y: 250, width: 128, height: 48 },
  { x: 140, y: 248, width: 66, height: 50 },
  { x: 210, y: 248, width: 62, height: 50 },
  { x: 280, y: 248, width: 62, height: 50 },
  { x: 350, y: 248, width: 58, height: 50 },
  { x: 415, y: 248, width: 58, height: 50 },
  { x: 480, y: 248, width: 62, height: 50 },
  { x: 550, y: 248, width: 62, height: 50 },
  { x: 620, y: 248, width: 58, height: 50 },
  { x: 685, y: 248, width: 62, height: 50 },
  { x: 750, y: 248, width: 62, height: 50 },
  { x: 820, y: 248, width: 62, height: 50 },
  { x: 880, y: 248, width: 80, height: 50 },
  { x: 960, y: 248, width: 40, height: 50 },
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
              className="absolute cursor-default rounded-lg transition duration-200 ease-out hover:z-10 hover:scale-110 hover:shadow-[0_12px_22px_rgba(2,44,34,0.28)]"
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
