import Image from "next/image";

export default function SponsorFooter() {
  return (
    <section className="border-b border-green-100 bg-white py-9 sm:py-12" aria-label="Official Partners">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Image
          src="/sponsors-pattani-fc-2026.png"
          alt="ผู้สนับสนุน Pattani FC"
          width={1000}
          height={326}
          sizes="(max-width: 1280px) 100vw, 1152px"
          className="h-auto w-full mix-blend-multiply"
        />
      </div>
    </section>
  );
}
