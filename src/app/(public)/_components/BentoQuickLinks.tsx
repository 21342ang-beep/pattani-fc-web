"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar,
  Newspaper,
  Users,
  ShoppingBag,
  Trophy,
  Ticket,
} from "lucide-react";

type Tile = {
  href: string;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  span?: string;
  tone?: "primary" | "accent" | "muted";
};

const tiles: Tile[] = [
  {
    href: "/matches",
    label: "โปรแกรมการแข่งขัน",
    desc: "ตารางแมตช์ ผลการแข่งขัน",
    Icon: Calendar,
    span: "sm:col-span-2 sm:row-span-2",
    tone: "accent",
  },
  {
    href: "/news",
    label: "ข่าวสาร",
    desc: "ความเคลื่อนไหวล่าสุด",
    Icon: Newspaper,
    tone: "primary",
  },
  {
    href: "/squad",
    label: "ผู้เล่น",
    desc: "นักเตะชุดใหญ่",
    Icon: Users,
    tone: "primary",
  },
  {
    href: "/tickets",
    label: "จองตั๋ว",
    desc: "เลือกโซน · ดูราคา",
    Icon: Ticket,
    tone: "muted",
  },
  {
    href: "/shop",
    label: "ร้านค้า",
    desc: "สินค้าทางการ",
    Icon: ShoppingBag,
    tone: "muted",
  },
  {
    href: "/club",
    label: "สโมสร",
    desc: "ประวัติและความเป็นมา",
    Icon: Trophy,
    span: "sm:col-span-2",
    tone: "primary",
  },
];

export default function BentoQuickLinks() {
  return (
    <div className="grid gap-3 sm:grid-cols-4 sm:auto-rows-[160px]">
      {tiles.map((t, i) => {
        const toneClass =
          t.tone === "accent"
            ? "bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-green-950 hover:from-yellow-200 hover:via-yellow-300 hover:to-amber-400"
            : t.tone === "muted"
              ? "bg-white text-green-900 hover:bg-green-50 border border-green-100"
              : "bg-gradient-to-br from-green-800 to-green-950 text-yellow-100 hover:from-green-700 hover:to-green-900";
        return (
          <motion.div
            key={t.href}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
              duration: 0.5,
              delay: i * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={t.span ?? ""}
          >
            <Link
              href={t.href}
              className={`group relative flex h-full min-h-[160px] flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${toneClass}`}
            >
              <div
                aria-hidden
                className="absolute -right-6 -top-6 size-32 rounded-full bg-white/10 blur-2xl transition-all duration-500 group-hover:scale-150"
              />
              <t.Icon className="relative size-7" />
              <div className="relative">
                <p className="text-lg font-bold leading-tight">{t.label}</p>
                <p className="mt-0.5 text-xs opacity-75">{t.desc}</p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
