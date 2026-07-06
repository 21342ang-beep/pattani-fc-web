"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Ticket, Gift, UserPlus } from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";

export default function HomeHero({ dict }: { dict: Dict }) {
  return (
    <section className="relative isolate overflow-hidden bg-green-950 text-white">
      {/* Team collage backdrop — sized to fit the board (whole image visible, centered) */}
      <Image
        src="/home-hero-bg-team-collage.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none absolute inset-0 -z-10 object-contain object-center opacity-55"
      />
      {/* Dark tint for legibility */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-green-950/75 via-green-950/65 to-green-950/85"
      />
      {/* Decorative background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
      />
      <motion.div
        aria-hidden
        className="absolute -left-32 top-1/4 size-[400px] rounded-full bg-emerald-400/10 blur-[120px]"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -right-32 bottom-0 size-[420px] rounded-full bg-yellow-400/10 blur-[140px]"
        animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 md:grid-cols-2 md:gap-12 md:py-16 lg:py-20">
        {/* LEFT — Identity cards (Pattani + Thai League 1) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col gap-5"
        >
          {/* PATTANI FC */}
          <div className="group relative overflow-hidden rounded-3xl border border-yellow-300/25 bg-gradient-to-br from-white/12 via-white/[0.06] to-transparent p-5 shadow-2xl shadow-black/40 backdrop-blur-md transition hover:border-yellow-300/45 md:p-6">
            <div
              aria-hidden
              className="absolute -right-10 -top-10 size-40 rounded-full bg-yellow-400/20 blur-3xl transition group-hover:bg-yellow-400/30"
            />
            <div className="relative flex items-center gap-5 md:gap-6">
              <div className="relative shrink-0">
                <div
                  aria-hidden
                  className="absolute -inset-3 rounded-full bg-yellow-400/25 blur-lg"
                />
                <div className="relative rounded-full bg-white/95 p-2 ring-2 ring-yellow-400/70 shadow-xl">
                  <Image
                    src="/logo-pattani-fc.png"
                    alt="โลโก้สโมสรปัตตานี เอฟซี"
                    width={160}
                    height={160}
                    className="size-20 object-contain md:size-24"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-yellow-300/85">
                  The Club
                </p>
                <p className="mt-1 text-2xl font-black leading-none text-white md:text-3xl">
                  ปัตตานี เอฟซี
                </p>
                <p className="mt-1.5 text-xs font-medium text-green-100/75 md:text-sm">
                  Langkasuka · EST. 2009
                </p>
              </div>
            </div>
          </div>

          {/* THAI LEAGUE 1 */}
          <div className="group relative overflow-hidden rounded-3xl border border-yellow-300/25 bg-gradient-to-br from-white/12 via-white/[0.06] to-transparent p-5 shadow-2xl shadow-black/40 backdrop-blur-md transition hover:border-yellow-300/45 md:p-6">
            <div
              aria-hidden
              className="absolute -right-10 -top-10 size-40 rounded-full bg-red-500/20 blur-3xl transition group-hover:bg-red-500/30"
            />
            <div className="relative flex items-center gap-5 md:gap-6">
              <div className="relative shrink-0">
                <div
                  aria-hidden
                  className="absolute -inset-3 rounded-2xl bg-red-500/25 blur-lg"
                />
                <div className="relative overflow-hidden rounded-2xl ring-2 ring-white/40 shadow-xl">
                  <Image
                    src="/badge-thai-league-1.png"
                    alt="ตราไทยลีก 1"
                    width={160}
                    height={160}
                    className="size-20 object-cover md:size-24"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-yellow-300/85">
                  Competition
                </p>
                <p className="mt-1 text-2xl font-black leading-none text-white md:text-3xl">
                  ไทยลีก 1
                </p>
                <p className="mt-1.5 text-xs font-medium text-green-100/75 md:text-sm">
                  ฤดูกาล 2026/2027
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT — รายละเอียดตาม screenshot */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="text-center md:text-left"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-400/10 px-3.5 py-1.5 text-xs font-semibold text-yellow-200 backdrop-blur-sm">
            <motion.span
              className="size-1.5 rounded-full bg-yellow-400"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {dict.hero.badge}
          </div>

          <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tighter sm:text-6xl md:text-6xl lg:text-7xl">
            <span className="block">{dict.hero.title1}</span>
            <span className="block bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
              {dict.hero.title2}
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base text-green-100/85 md:text-lg">
            {dict.hero.description}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link
              href="/matches"
              className="group inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-base font-semibold text-green-950 shadow-lg shadow-yellow-400/20 transition-all hover:scale-105 hover:bg-yellow-300 hover:shadow-yellow-400/40"
            >
              <Ticket className="size-5" /> {dict.hero.ctaMatches}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/bookings/check"
              className="group inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-white/5 px-6 py-3 text-base font-medium text-yellow-100 backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/10"
            >
              {dict.hero.ctaCheck}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-5 inline-flex max-w-xl items-center gap-3 rounded-2xl border border-yellow-300/30 bg-gradient-to-r from-yellow-400/10 via-yellow-300/5 to-transparent px-4 py-3 backdrop-blur-sm">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-yellow-400/20 text-yellow-300">
              <Gift className="size-5" />
            </div>
            <div className="flex-1 text-left text-sm">
              <p className="font-bold text-yellow-200">
                {dict.hero.memberCtaTitle}
              </p>
              <p className="text-xs text-green-100/70">
                {dict.hero.memberCtaDesc}
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-green-950 transition hover:scale-105 hover:bg-yellow-300"
            >
              <UserPlus className="size-4" /> {dict.hero.memberCtaButton}
            </Link>
          </div>

          <div className="mt-8 border-t border-yellow-300/20 pt-5">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-300 md:text-sm">
              {dict.hero.presentedBy}
            </span>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 md:justify-start md:gap-4">
              <div className="rounded-2xl bg-white px-4 py-2.5 shadow-xl shadow-black/30">
                <Image
                  src="/sponsor-unique-v2.png"
                  alt="UNiQUE 2 พี่น้อง"
                  width={280}
                  height={120}
                  unoptimized
                  className="h-12 w-auto object-contain md:h-16"
                  priority
                />
              </div>
              <div className="rounded-2xl bg-white px-4 py-2.5 shadow-xl shadow-black/30">
                <Image
                  src="/sponsor-hihi-buffet-v2.png"
                  alt="hihi buffet"
                  width={280}
                  height={120}
                  unoptimized
                  className="h-12 w-auto object-contain md:h-16"
                  priority
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
