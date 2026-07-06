"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import LocaleSwitcher from "./_components/LocaleSwitcher";
import type { Dict, Locale } from "@/lib/i18n/dict";

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

type CustomerInfo = { name: string; email: string } | null;

export default function TopNav({
  customer,
  locale,
  dict,
}: {
  customer: CustomerInfo;
  locale: Locale;
  dict: Dict;
}) {
  const path = usePathname();
  const items = [
    { href: "/", label: dict.nav.home },
    { href: "/club", label: dict.nav.club },
    { href: "/news", label: dict.nav.news },
    { href: "/management", label: dict.nav.management },
    { href: "/squad", label: dict.nav.squad },
    { href: "/youth", label: dict.nav.youth },
    { href: "/matches", label: dict.nav.matches },
    { href: "/tickets", label: dict.nav.tickets },
    { href: "/partners", label: dict.nav.partners },
    { href: "/shop", label: dict.nav.shop },
  ];
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  return (
    <header className="sticky top-0 z-40">
      <motion.div
        animate={{
          height: scrolled ? 0 : "auto",
          opacity: scrolled ? 0 : 1,
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden bg-gradient-to-r from-yellow-400 via-yellow-300 to-green-700"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-4 py-2 text-base font-bold text-green-950">
          <Link href="/bookings/check" className="hover:underline">
            {dict.util.checkBooking}
          </Link>
          <Link href="/faq" className="hover:underline">
            {dict.util.faq}
          </Link>
          <Link href="/contact" className="hover:underline">
            {dict.util.contact}
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-green-900/80 hover:text-green-950 hover:underline"
            title={dict.util.admin}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="size-3.5"
              aria-hidden
            >
              <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
            </svg>
            {dict.util.admin}
          </Link>
          <LocaleSwitcher current={locale} />
        </div>
      </motion.div>

      <motion.div
        animate={{
          backgroundColor: scrolled
            ? "rgba(3, 30, 18, 0.85)"
            : "rgba(3, 30, 18, 1)",
          backdropFilter: scrolled ? "blur(16px) saturate(180%)" : "blur(0px)",
        }}
        transition={{ duration: 0.25 }}
        className="text-yellow-100 shadow-lg shadow-green-950/20"
      >
        <motion.div
          animate={{ paddingTop: scrolled ? 8 : 12, paddingBottom: scrolled ? 8 : 12 }}
          transition={{ duration: 0.25 }}
          className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4"
        >
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              animate={{ scale: scrolled ? 0.78 : 1 }}
              transition={{ duration: 0.25 }}
              className="origin-left"
            >
              <Image
                src="/logo-pattani-fc.png"
                alt="Pattani FC"
                width={56}
                height={56}
                priority
              />
            </motion.div>
            <motion.div
              animate={{ opacity: scrolled ? 0.95 : 1 }}
              className="flex flex-col leading-tight"
            >
              <span className="text-2xl font-black tracking-wide sm:text-3xl">
                <span className="bg-gradient-to-r from-yellow-300 to-yellow-200 bg-clip-text text-transparent">
                  {dict.brand.name}
                </span>
                <span className="ml-2 text-base font-normal text-yellow-100/70 sm:text-lg">
                  {dict.brand.suffix}
                </span>
              </span>
              <motion.span
                animate={{ height: scrolled ? 0 : "auto", opacity: scrolled ? 0 : 1 }}
                className="overflow-hidden text-xs uppercase tracking-widest text-green-200"
              >
                {dict.brand.motto}
              </motion.span>
            </motion.div>
          </Link>

          {customer ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/member"
                className="inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-white/5 px-4 py-2 text-sm font-semibold text-yellow-100 backdrop-blur-sm transition hover:bg-white/10"
              >
                <span className="grid size-7 place-items-center rounded-full bg-yellow-400 text-sm font-black text-green-950">
                  {customer.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[10rem] truncate">{customer.name}</span>
              </Link>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/member/login"
                className="rounded-full border border-yellow-300/40 px-5 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-white/10"
              >
                {dict.auth.login}
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-yellow-400 px-5 py-2 text-sm font-bold text-green-950 transition-all hover:scale-105 hover:bg-yellow-300 hover:shadow-lg hover:shadow-yellow-400/30"
              >
                {dict.auth.register}
              </Link>
            </div>
          )}
        </motion.div>

        <nav className="border-t border-yellow-300/10 bg-green-900/60 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-2 py-2.5 text-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((it) => {
              const active = isActive(path, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`relative whitespace-nowrap rounded-full px-6 py-2.5 font-bold tracking-wide transition-colors ${
                    active
                      ? "text-green-950"
                      : "text-white hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-yellow-400"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </motion.div>
    </header>
  );
}
