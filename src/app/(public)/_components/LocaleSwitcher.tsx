"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Globe } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n/dict";

// แสดงชื่อภาษาในภาษาของตัวเอง (native name) ไม่ผูกกับ locale ปัจจุบัน
const OPTIONS: { value: Locale; label: string }[] = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];

export default function LocaleSwitcher({
  current,
  openUp = false,
}: {
  current: Locale;
  openUp?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกนอกพื้นที่
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const choose = (l: Locale) => {
    setOpen(false);
    if (l === current || pending) return;
    startTransition(() => {
      void setLocale(l);
    });
  };

  const currentLabel =
    OPTIONS.find((o) => o.value === current)?.label ?? current.toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Language"
        suppressHydrationWarning
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold transition hover:opacity-70 ${
          pending ? "opacity-60" : ""
        }`}
      >
        <Globe className="size-4" aria-hidden strokeWidth={2.5} />
        <span suppressHydrationWarning>{currentLabel}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 w-36 overflow-hidden rounded-lg border border-green-900/15 bg-white py-1 text-sm text-green-950 shadow-xl ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={current === o.value}
              onClick={() => choose(o.value)}
              disabled={pending}
              suppressHydrationWarning
              className={`flex w-full items-center justify-between px-3 py-2 text-left font-semibold transition-colors ${
                current === o.value
                  ? "bg-green-50 text-green-800"
                  : "hover:bg-green-50"
              }`}
            >
              {o.label}
              {current === o.value && <Check className="size-4" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
