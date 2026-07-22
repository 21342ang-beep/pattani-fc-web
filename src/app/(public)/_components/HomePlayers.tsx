"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";
import { useEffect, useState } from "react";

export type HomePlayer = {
  id: string | number;
  name: string;
  jerseyNumber?: number | null;
  position: "GK" | "DF" | "MF" | "FW";
  photo?: { url?: string | null } | string | number | null;
};

const positionLabel: Record<HomePlayer["position"], string> = {
  GK: "ผู้รักษาประตู",
  DF: "กองหลัง",
  MF: "กองกลาง",
  FW: "กองหน้า",
};

const positionTone: Record<HomePlayer["position"], string> = {
  GK: "from-amber-300 to-yellow-500",
  DF: "from-sky-300 to-blue-600",
  MF: "from-emerald-300 to-green-600",
  FW: "from-rose-300 to-red-600",
};

export default function HomePlayers({ players }: { players: HomePlayer[] }) {
  const [activeIndex, setActiveIndex] = useState(() => Math.min(1, Math.max(0, players.length - 1)));
  const hasCarousel = players.length > 3;

  useEffect(() => {
    if (!hasCarousel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % players.length);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [hasCarousel, players.length]);

  if (players.length === 0) return null;
  const visiblePlayers = hasCarousel
    ? [-1, 0, 1].map((offset) => players[(activeIndex + offset + players.length) % players.length])
    : players;
  const centerCardIndex = hasCarousel ? 1 : Math.floor((visiblePlayers.length - 1) / 2);

  return (
    <section className="rounded-3xl border border-green-100 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10">
      <div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-lg font-bold uppercase tracking-widest text-yellow-600">Our squad</p>
            <h2 className="mt-1 text-5xl font-black text-green-900 sm:text-6xl">ผู้เล่นปัตตานี เอฟซี</h2>
          </div>
          <Link
            href="/squad"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-200 px-5 py-2.5 text-lg font-bold text-green-800 transition hover:bg-green-800 hover:text-yellow-300 sm:text-xl"
          >
            ดูทีมทั้งหมด <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mx-auto max-w-4xl overflow-hidden px-2 py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={String(activeIndex)}
              initial={{ opacity: 0, x: 72 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -72 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="grid grid-cols-3 items-center gap-3 sm:gap-5"
            >
              {visiblePlayers.map((player, index) => (
                <li key={String(player.id)}>
                  <PlayerSpotlight player={player} featured={index === centerCardIndex} />
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>

        {hasCarousel && (
          <div className="mt-4 flex justify-center gap-2" aria-label="เลือกผู้เล่น">
            {players.map((player, index) => (
              <button
                key={String(player.id)}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`แสดง ${player.name}`}
                aria-current={index === activeIndex}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex ? "w-6 bg-green-800" : "w-2 bg-green-200 hover:bg-green-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PlayerSpotlight({ player, featured }: { player: HomePlayer; featured: boolean }) {
  const photoUrl = mediaUrl(player.photo);
  const number = player.jerseyNumber?.toString().padStart(2, "0") ?? "--";

  return (
    <article className={`group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-green-800 to-green-950 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${
      featured ? "-translate-y-4 scale-105 shadow-2xl shadow-green-950/30" : "scale-95 opacity-85 shadow-md"
    }`}>
      <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${positionTone[player.position]}`} />
      <span aria-hidden className="absolute -right-2 top-1 select-none text-7xl font-black leading-none text-white/[0.08] sm:text-8xl">
        {number}
      </span>
      <span className="absolute left-3 top-4 rounded-full bg-black/25 px-2 py-1 text-sm font-bold uppercase tracking-widest text-yellow-200 backdrop-blur-sm sm:text-base">
        {positionLabel[player.position]}
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
        <h3 className="line-clamp-1 text-lg font-black sm:text-xl">{player.name}</h3>
      </div>
    </article>
  );
}

function mediaUrl(media: HomePlayer["photo"]) {
  return typeof media === "object" && media !== null && "url" in media
    ? media.url ?? undefined
    : undefined;
}
