"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Calendar,
  Newspaper,
  Users,
  ShoppingBag,
  Trophy,
  Ticket,
  MapPin,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";

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
    span: "sm:col-span-4 sm:row-span-3",
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

type OnSaleMatch = {
  id: string; homeTeam: string; awayTeam: string; homeTeamLogo: string | null; awayTeamLogo: string | null;
  kickoffAt: Date | string | null; venue: string | null;
};

export default function BentoQuickLinks({ onSaleMatch }: { onSaleMatch?: OnSaleMatch }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4 sm:auto-rows-[160px]">
      {tiles.map((t, i) => {
        const isOnSaleBoard = t.href === "/matches" && onSaleMatch;
        if (isOnSaleBoard) return null;
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
              href={isOnSaleBoard ? `/matches/${onSaleMatch.id}` : t.href}
              className={`group relative flex h-full min-h-[160px] flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${toneClass}`}
            >
              {isOnSaleBoard && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 text-white">
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-emerald-300"><span>Book now</span><span className="rounded-full bg-emerald-400 px-2 py-1 text-green-950">เปิดจอง</span></div>
                  <div className="absolute inset-x-12 top-[42%] flex -translate-y-1/2 items-center justify-between gap-8 text-center text-lg font-bold"><TeamMark large logo={onSaleMatch.homeTeamLogo} name={onSaleMatch.homeTeam} /><span className="text-2xl text-yellow-300">VS</span><TeamMark large logo={onSaleMatch.awayTeamLogo} name={onSaleMatch.awayTeam} /></div>
                  <div className="absolute inset-x-4 bottom-4 border-t border-white/20 pt-2 text-[10px] text-emerald-100"><p>{onSaleMatch.kickoffAt ? formatDateTime(onSaleMatch.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}</p><p className="mt-0.5 flex items-center gap-1"><MapPin className="size-3 text-yellow-300" />{onSaleMatch.venue ?? "ยังไม่กำหนดสนาม"}</p><div className="mt-2 flex items-center justify-between"><span className="font-black text-yellow-300">ราคาแยกตามโซน</span><span className="rounded-full bg-yellow-300 px-2.5 py-1 font-bold text-green-950">จองตั๋ว</span></div></div>
                </div>
              )}
              <div
                aria-hidden
                className="absolute -right-6 -top-6 size-32 rounded-full bg-white/10 blur-2xl transition-all duration-500 group-hover:scale-150"
              />
              {!isOnSaleBoard && <t.Icon className="relative size-7" />}
              <div className={`relative ${isOnSaleBoard ? "pointer-events-none opacity-0" : ""}`}>
                <p className="text-lg font-bold leading-tight">{isOnSaleBoard ? "โปรแกรมการแข่งขัน" : t.label}</p>
                <p className="mt-0.5 text-xs opacity-75">{isOnSaleBoard ? "กดเพื่อจองตั๋ว" : t.desc}</p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function TeamMark({ logo, name, large }: { logo: string | null; name: string; large?: boolean }) {
  return <span className={`flex flex-col items-center gap-2 ${large ? "max-w-48" : "max-w-24"}`}><span className={`flex items-center justify-center overflow-hidden rounded-full bg-white p-1 ${large ? "size-24" : "size-12"}`}>{logo && <Image src={logo} alt="" width={96} height={96} unoptimized className="size-full object-contain" />}</span><span className="line-clamp-2">{name}</span></span>;
}
