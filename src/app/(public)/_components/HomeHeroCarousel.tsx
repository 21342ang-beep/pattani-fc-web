"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type Slide = { url: string; mimeType?: string | null };

export default function HomeHeroCarousel({ slides }: { slides: Slide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = slides.length;

  useEffect(() => {
    if (total < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % total);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [total]);

  const showPrevious = () => setActiveIndex((current) => (current - 1 + total) % total);
  const showNext = () => setActiveIndex((current) => (current + 1) % total);

  return (
    <div className="relative mx-auto aspect-[1584/672] w-full overflow-hidden">
      {slides.map((slide, index) => (
        slide.mimeType?.startsWith("video/") ? (
          <video
            key={slide.url}
            autoPlay
            muted
            loop
            playsInline
            preload={index === activeIndex ? "auto" : "metadata"}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
          >
            <source src={slide.url} type={slide.mimeType} />
          </video>
        ) : (
          <Image
            key={slide.url}
            src={slide.url}
            alt="ภาพประชาสัมพันธ์ Pattani FC"
            fill
            fetchPriority={index === 0 ? "high" : "auto"}
            sizes="100vw"
            className={`object-cover transition-opacity duration-700 ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
          />
        )
      ))}

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={showPrevious}
            aria-label="ภาพก่อนหน้า"
            className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/60 sm:left-5 sm:size-11"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label="ภาพถัดไป"
            className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/60 sm:right-5 sm:size-11"
          >
            <ChevronRight className="size-6" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-5">
            {slides.map((slide, index) => (
              <button
                key={`${slide.url}-dot`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`แสดงภาพที่ ${index + 1}`}
                aria-current={index === activeIndex}
                className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-6 bg-yellow-300" : "w-2 bg-white/70 hover:bg-white"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
