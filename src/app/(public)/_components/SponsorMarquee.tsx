"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Sponsor = { name: string; logoUrl?: string };

// 3s ต่อโล้โก้ — เห็นชัดทุกราย ไม่แวบผ่าน
const SECONDS_PER_SPONSOR = 3;

export default function SponsorMarquee({ sponsors }: { sponsors: Sponsor[] }) {
  const [paused, setPaused] = useState(false);
  if (sponsors.length === 0) return null;

  // duplicate แค่ 2 ชุดพอ — animate ไป -50% = ครบ 1 set เป๊ะ (ไม่มี gap drift)
  const list = [...sponsors, ...sponsors];
  const duration = Math.max(18, sponsors.length * SECONDS_PER_SPONSOR);

  return (
    <div
      className="relative overflow-hidden border-y border-green-100 bg-white py-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label={`สปอนเซอร์ทั้งหมด ${sponsors.length} ราย`}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />
      <motion.div
        // pr-8 เท่า gap-8 → border-box width = 2 × (setWidth + gap)
        // ทำให้ -50% เลื่อนเป๊ะ 1 setWidth + 1 gap = ตำแหน่งเริ่ม set ที่ 2
        // → loop seamless ไม่มีโล้โก้กระโดดข้าม
        className="flex w-max gap-8 pr-8"
        animate={paused ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        {list.map((s, i) => (
          <div
            key={`${i}-${s.name}`}
            className="flex h-28 w-56 shrink-0 items-center justify-center"
            aria-hidden={i >= sponsors.length}
          >
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logoUrl}
                alt={s.name}
                loading="lazy"
                className="max-h-24 max-w-full object-contain transition-transform hover:scale-110"
              />
            ) : (
              <span className="text-sm font-bold uppercase tracking-wider text-green-900/40">
                {s.name}
              </span>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
