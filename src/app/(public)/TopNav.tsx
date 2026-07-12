"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  motion,
  useScroll,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import { useEffect, useState } from "react";
import { Menu, X, Shield } from "lucide-react";
import LocaleSwitcher from "./_components/LocaleSwitcher";
import type { Dict, Locale } from "@/lib/i18n/dict";

function isActive(path: string, href: string) {
  const base = href.split("#")[0];
  if (base === "/") return path === "/";
  return path === base || path.startsWith(base + "/");
}

// child ที่เจาะจงกว่า (เช่น /tickets/season) ต้องชนะ child ที่กว้างกว่า (/tickets)
function childIsActive(
  path: string,
  href: string,
  siblings: { href: string }[],
) {
  if (!isActive(path, href)) return false;
  return !siblings.some(
    (s) => s.href !== href && s.href.startsWith(href + "/") && isActive(path, s.href),
  );
}

type NavItem =
  | { href: string; label: string }
  | { label: string; children: { href: string; label: string }[] };

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
  const items: NavItem[] = [
    { href: "/", label: dict.nav.home },
    {
      label: dict.nav.about,
      children: [
        { href: "/club", label: dict.nav.club },
        { href: "/management", label: dict.nav.management },
        { href: "/squad", label: dict.nav.squad },
        { href: "/youth", label: dict.nav.youth },
      ],
    },
    {
      label: dict.nav.tickets,
      children: [
        { href: "/tickets", label: dict.nav.ticketsByMatch },
        { href: "/tickets/season", label: dict.nav.ticketsByYear },
      ],
    },
    { href: "/matches", label: dict.nav.matches },
    { href: "/news", label: dict.nav.news },
    { href: "/shop", label: dict.nav.shop },
    { href: "/contact", label: dict.nav.contact },
  ];
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // กลุ่มที่กางอยู่ใน drawer mobile (accordion) — ลด tab รก
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  // ปิด dropdown + mobile drawer เมื่อเปลี่ยนหน้า
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [path]);

  // กางกลุ่ม accordion ที่มีหน้า active อยู่ (ให้ผู้ใช้เห็นตำแหน่งปัจจุบัน)
  useEffect(() => {
    const activeGroup = items.find(
      (it) => "children" in it && it.children.some((c) => isActive(path, c.href)),
    );
    if (activeGroup) {
      setOpenGroups((prev) =>
        prev.includes(activeGroup.label) ? prev : [...prev, activeGroup.label],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Lock body scroll ตอน drawer เปิด (กัน scroll ทะลุไปหลัง overlay)
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40">
      {/* Utility bar — desktop only (mobile ย้ายไปใน drawer) */}
      <motion.div
        animate={{
          height: scrolled ? 0 : "auto",
          opacity: scrolled ? 0 : 1,
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden overflow-hidden bg-gradient-to-r from-yellow-400 via-yellow-300 to-green-700 xl:block"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-4 py-2 text-base font-bold text-green-950">
          <Link href="/bookings/check" className="hover:underline">
            {dict.util.checkBooking}
          </Link>
          <Link href="/faq" className="hover:underline">
            {dict.util.faq}
          </Link>
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
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <motion.div
              animate={{ scale: scrolled ? 0.78 : 1 }}
              transition={{ duration: 0.25 }}
              className="origin-left shrink-0"
            >
              <Image
                src="/logo-pattani-fc.png"
                alt="Pattani FC"
                width={56}
                height={56}
                priority
                className="size-11 sm:size-14"
              />
            </motion.div>
            <motion.div
              animate={{ opacity: scrolled ? 0.95 : 1 }}
              className="flex min-w-0 flex-col leading-tight"
            >
              <span className="truncate text-xl font-black tracking-wide sm:text-3xl">
                <span className="bg-gradient-to-r from-yellow-300 to-yellow-200 bg-clip-text text-transparent">
                  {dict.brand.name}
                </span>
                <span className="ml-2 hidden text-base font-normal text-yellow-100/70 sm:inline sm:text-lg">
                  {dict.brand.suffix}
                </span>
              </span>
              <motion.span
                animate={{ height: scrolled ? 0 : "auto", opacity: scrolled ? 0 : 1 }}
                className="hidden overflow-hidden text-xs uppercase tracking-widest text-green-200 sm:block"
              >
                {dict.brand.motto}
              </motion.span>
            </motion.div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Auth buttons — desktop only */}
            {customer ? (
              <div className="hidden items-center gap-2 xl:flex">
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
              <div className="hidden items-center gap-2 xl:flex">
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

            {/* ตัวเปลี่ยนภาษา — desktop, ค้างข้างปุ่ม auth ตลอด (ไม่หุบตาม utility bar) */}
            <div className="hidden xl:block">
              <LocaleSwitcher current={locale} />
            </div>

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="เปิดเมนู"
              aria-expanded={mobileOpen}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-yellow-300/30 bg-white/5 text-yellow-100 transition hover:bg-white/10 xl:hidden"
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </div>
        </motion.div>

        {/* Desktop nav — hidden below md */}
        <nav className="hidden border-t border-yellow-300/10 bg-green-900/60 backdrop-blur-sm xl:block">
          <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-visible px-2 py-2.5 text-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((it) => {
              if ("children" in it) {
                const active = it.children.some((c) => isActive(path, c.href));
                const isOpen = openMenu === it.label;
                return (
                  <div
                    key={it.label}
                    className="relative"
                    onMouseEnter={() => setOpenMenu(it.label)}
                    onMouseLeave={() => setOpenMenu(null)}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu(isOpen ? null : it.label)
                      }
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                      className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-6 py-2.5 font-bold tracking-wide transition-colors ${
                        active ? "text-green-950" : "text-white hover:text-white"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-full bg-yellow-400"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                      <span className="relative">{it.label}</span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden
                        className={`relative size-4 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    {isOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-yellow-300/20 bg-green-950/95 py-1 text-base shadow-xl backdrop-blur-md"
                      >
                        {it.children.map((c) => {
                          const childActive = childIsActive(path, c.href, it.children);
                          return (
                            <Link
                              key={c.href}
                              href={c.href}
                              role="menuitem"
                              className={`block whitespace-nowrap px-5 py-2.5 font-semibold transition-colors ${
                                childActive
                                  ? "bg-yellow-400 text-green-950"
                                  : "text-yellow-100 hover:bg-green-900"
                              }`}
                            >
                              {c.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              const active = isActive(path, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`relative whitespace-nowrap rounded-full px-6 py-2.5 font-bold tracking-wide transition-colors ${
                    active ? "text-green-950" : "text-white hover:text-white"
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

      {/* Mobile drawer — slide from right */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden"
              aria-hidden
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col bg-green-950 text-yellow-100 shadow-2xl xl:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="เมนูหลัก"
            >
              <div className="flex items-center justify-between border-b border-yellow-300/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Image
                    src="/logo-pattani-fc.png"
                    alt="Pattani FC"
                    width={36}
                    height={36}
                  />
                  <span className="font-black tracking-wide text-yellow-300">
                    {dict.brand.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="ปิดเมนู"
                  className="grid size-10 place-items-center rounded-full text-yellow-100 transition hover:bg-white/10"
                >
                  <X className="size-6" aria-hidden />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
                {customer ? (
                  <Link
                    href="/member"
                    className="mb-4 flex items-center gap-3 rounded-2xl border border-yellow-300/30 bg-white/5 p-3"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-yellow-400 text-lg font-black text-green-950">
                      {customer.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-yellow-100">
                        {customer.name}
                      </p>
                      <p className="truncate text-xs text-yellow-100/60">
                        {customer.email}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <Link
                      href="/member/login"
                      className="rounded-full border border-yellow-300/40 px-4 py-2.5 text-center text-sm font-semibold text-yellow-100"
                    >
                      {dict.auth.login}
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-full bg-yellow-400 px-4 py-2.5 text-center text-sm font-bold text-green-950"
                    >
                      {dict.auth.register}
                    </Link>
                  </div>
                )}

                <nav className="space-y-0.5">
                  {items.map((it) => {
                    if ("children" in it) {
                      const isOpen = openGroups.includes(it.label);
                      const groupActive = it.children.some((c) =>
                        isActive(path, c.href),
                      );
                      return (
                        <div key={it.label}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(it.label)}
                            aria-expanded={isOpen}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-base font-bold transition-colors hover:bg-white/5 ${
                              groupActive ? "text-yellow-300" : "text-yellow-100"
                            }`}
                          >
                            <span>{it.label}</span>
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden
                              className={`size-5 transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="ml-3 space-y-0.5 border-l border-yellow-300/15 py-1 pl-2">
                                  {it.children.map((c) => {
                                    const active = childIsActive(
                                      path,
                                      c.href,
                                      it.children,
                                    );
                                    return (
                                      <Link
                                        key={c.href}
                                        href={c.href}
                                        className={`block rounded-xl px-3 py-2.5 text-base font-semibold transition-colors ${
                                          active
                                            ? "bg-yellow-400 text-green-950"
                                            : "text-yellow-100 hover:bg-white/5"
                                        }`}
                                      >
                                        {c.label}
                                      </Link>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    }
                    const active = isActive(path, it.href);
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`block rounded-xl px-3 py-3 text-base font-bold transition-colors ${
                          active
                            ? "bg-yellow-400 text-green-950"
                            : "text-yellow-100 hover:bg-white/5"
                        }`}
                      >
                        {it.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-6 border-t border-yellow-300/10 pt-3">
                  <p className="mb-1 px-3 pt-1 text-[11px] font-bold uppercase tracking-widest text-yellow-300/60">
                    บริการ
                  </p>
                  <Link
                    href="/bookings/check"
                    className="block rounded-xl px-3 py-2.5 text-sm text-yellow-100 hover:bg-white/5"
                  >
                    {dict.util.checkBooking}
                  </Link>
                  <Link
                    href="/faq"
                    className="block rounded-xl px-3 py-2.5 text-sm text-yellow-100 hover:bg-white/5"
                  >
                    {dict.util.faq}
                  </Link>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-yellow-100 hover:bg-white/5"
                  >
                    <Shield className="size-4" aria-hidden strokeWidth={2.5} />
                    {dict.util.admin}
                  </Link>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-yellow-300/10 bg-green-950/80 px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-yellow-300/60">
                  {dict.locale.label}
                </span>
                <LocaleSwitcher current={locale} openUp />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
