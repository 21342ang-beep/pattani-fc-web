"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function IdentityStrip() {
  return (
    <section className="relative overflow-hidden border-y border-yellow-300/20 bg-gradient-to-r from-green-950 via-green-900 to-green-950">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <div className="relative mx-auto grid max-w-7xl items-stretch gap-6 px-4 py-10 md:grid-cols-[1fr_auto_1fr] md:py-14">
        {/* ฝั่งสโมสร — โลโก้ Pattani FC */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center gap-5 rounded-2xl border border-yellow-300/20 bg-white/5 p-5 backdrop-blur-sm md:justify-end md:gap-6 md:bg-transparent md:p-0 md:backdrop-blur-none"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="shrink-0"
          >
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-full bg-yellow-400/25 blur-2xl"
              />
              <div className="relative rounded-full bg-white/95 p-3 ring-2 ring-yellow-400/60 shadow-2xl shadow-black/40">
                <Image
                  src="/logo-pattani-fc.png"
                  alt="โลโก้สโมสรปัตตานี เอฟซี"
                  width={200}
                  height={200}
                  className="size-20 object-contain md:size-28"
                />
              </div>
            </div>
          </motion.div>
          <div className="md:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-300/80 md:text-sm">
              The Club
            </p>
            <h3 className="mt-1 text-2xl font-black leading-tight text-white md:text-3xl">
              ปัตตานี เอฟซี
            </h3>
            <p className="mt-1 text-sm text-green-100/70 md:text-base">
              Langkasuka · EST. 2009
            </p>
          </div>
        </motion.div>

        {/* เส้นคั่นกลาง */}
        <div className="hidden md:flex md:flex-col md:items-center md:justify-center md:gap-2">
          <span className="h-16 w-px bg-gradient-to-b from-transparent via-yellow-400/60 to-transparent" />
          <span className="rounded-full border border-yellow-300/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300">
            2025 — 2026
          </span>
          <span className="h-16 w-px bg-gradient-to-b from-transparent via-yellow-400/60 to-transparent" />
        </div>

        {/* ฝั่งลีก — ตรา Thai League 1 */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center gap-5 rounded-2xl border border-yellow-300/20 bg-white/5 p-5 backdrop-blur-sm md:justify-start md:gap-6 md:bg-transparent md:p-0 md:backdrop-blur-none"
        >
          <div className="md:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-300/80 md:text-sm">
              Competition
            </p>
            <h3 className="mt-1 text-2xl font-black leading-tight text-white md:text-3xl">
              ไทยลีก 1
            </h3>
            <p className="mt-1 text-sm text-green-100/70 md:text-base">
              Thai League 1 · Promotion
            </p>
          </div>
          <motion.div
            animate={{ rotate: [0, 2, 0, -2, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="shrink-0"
          >
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-full bg-red-500/25 blur-2xl"
              />
              <div className="relative overflow-hidden rounded-2xl ring-2 ring-white/30 shadow-2xl shadow-black/40">
                <Image
                  src="/badge-thai-league-1.png"
                  alt="สวัสดีไทยลีก 1 — Thai League 1"
                  width={240}
                  height={240}
                  className="size-24 object-cover md:size-32"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
