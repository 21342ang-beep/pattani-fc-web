import Image from "next/image";

const SPONSOR_IMAGE = "/sponsors-pattani-fc-2026-v3.png";
const IMAGE_WIDTH = 3000;
const IMAGE_HEIGHT = 1175;

export default function SponsorFooter() {
  return (
    <section className="border-b border-green-100 bg-white py-8 sm:py-10" aria-label="Official Partners">
      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        <Image
          src={SPONSOR_IMAGE}
          alt="ผู้สนับสนุน Pattani FC"
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="h-auto w-full object-contain"
        />
      </div>
    </section>
  );
}
