"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n/dict";

export type HomePlayer = {
  id: string | number;
  name: string;
  jerseyNumber?: number | null;
  position: "GK" | "DF" | "MF" | "FW";
  photo?: { url?: string | null } | string | number | null;
};

const positionTone: Record<HomePlayer["position"], string> = {
  GK: "from-amber-300 to-yellow-500",
  DF: "from-sky-300 to-blue-600",
  MF: "from-emerald-300 to-green-600",
  FW: "from-rose-300 to-red-600",
};

export default function HomePlayers({ players, labels }: { players: HomePlayer[]; labels: Dict["home"] }) {
  const playersPerSlide = 4;
  const slides = Array.from(
    { length: Math.ceil(players.length / playersPerSlide) },
    (_, index) => players.slice(index * playersPerSlide, (index + 1) * playersPerSlide),
  );
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLoopReset, setIsLoopReset] = useState(false);
  const hasCarousel = slides.length > 1;
  const displaySlides = hasCarousel ? [...slides, slides[0]] : slides;

  useEffect(() => {
    if (!hasCarousel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveSlide((current) => current + 1);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [hasCarousel, slides.length]);

  if (players.length === 0) return null;
  return (
    <section>
      <div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-lg font-bold uppercase tracking-widest text-yellow-600">{labels.squadEyebrow}</p>
            <h2 className="mt-1 text-5xl font-black text-green-900 sm:text-6xl">{labels.squadTitle}</h2>
          </div>
          <Link
            href="/squad"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-200 px-5 py-2.5 text-lg font-bold text-green-800 transition hover:bg-green-800 hover:text-yellow-300 sm:text-xl"
          >
            {labels.viewSquad} <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mx-auto max-w-6xl overflow-hidden px-2 py-6">
          <motion.div
            animate={{ x: `-${(activeSlide * 100) / displaySlides.length}%` }}
            transition={isLoopReset ? { duration: 0 } : { duration: 0.65, ease: "easeInOut" }}
            onAnimationComplete={() => {
              if (hasCarousel && activeSlide === slides.length) {
                setIsLoopReset(true);
                setActiveSlide(0);
                requestAnimationFrame(() => setIsLoopReset(false));
              }
            }}
            className="flex"
          >
            {displaySlides.map((slide, slideIndex) => (
              <ul
                key={`${slide.map((player) => player.id).join("-")}-${slideIndex}`}
                className="grid w-full shrink-0 grid-cols-2 gap-3 pr-3 sm:grid-cols-4 sm:gap-5 sm:pr-5"
              >
                {slide.map((player) => (
                  <li key={String(player.id)}>
                    <PlayerSpotlight player={player} labels={labels} />
                  </li>
                ))}
              </ul>
            ))}
          </motion.div>
        </div>

        {hasCarousel && (
          <div className="mt-4 flex justify-center gap-2" aria-label={labels.playerCarouselLabel}>
            {slides.map((slide, index) => (
              <button
                key={slide.map((player) => player.id).join("-")}
                type="button"
                onClick={() => {
                  setIsLoopReset(false);
                  setActiveSlide(index);
                }}
                aria-label={`${labels.showPlayerSet} ${index + 1}`}
                aria-current={index === activeSlide}
                className={`h-2 rounded-full transition-all ${
                  index === activeSlide ? "w-6 bg-green-800" : "w-2 bg-green-200 hover:bg-green-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PlayerSpotlight({ player, labels }: { player: HomePlayer; labels: Dict["home"] }) {
  const photoUrl = mediaUrl(player.photo);
  const number = player.jerseyNumber?.toString().padStart(2, "0") ?? "--";

  return (
    <article className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-green-800 to-green-950 shadow-md">
      <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${positionTone[player.position]}`} />
      <span aria-hidden className="absolute -right-2 top-1 select-none text-7xl font-black leading-none text-white/[0.08] sm:text-8xl">
        {number}
      </span>
      <span className="absolute left-3 top-2 rounded-full bg-black/25 px-2 py-1 text-sm font-bold uppercase tracking-widest text-yellow-200 backdrop-blur-sm sm:text-base">
        {{ GK: labels.goalkeeper, DF: labels.defender, MF: labels.midfielder, FW: labels.forward }[player.position]}
      </span>

      <div className="absolute inset-x-3 bottom-12 top-9 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_20%,rgba(250,204,21,.26),transparent_55%)]">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={player.name}
            fill
            unoptimized
            sizes="(min-width: 640px) 25vw, 50vw"
            className="object-cover object-top transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-yellow-200/45">
            <Shield className="size-16" />
          </div>
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-green-950 to-transparent" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-green-900 px-3 py-2.5">
        <span className="text-4xl font-black text-yellow-300">{number}</span>
        <h3 className="line-clamp-1 text-lg font-black text-white sm:text-xl">{player.name}</h3>
      </div>
    </article>
  );
}

function mediaUrl(media: HomePlayer["photo"]) {
  return typeof media === "object" && media !== null && "url" in media
    ? media.url ?? undefined
    : undefined;
}
