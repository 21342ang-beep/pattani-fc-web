"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n/dict";

export default function LocaleSwitcher({ current }: { current: Locale }) {
  const [pending, startTransition] = useTransition();

  const choose = (l: Locale) => {
    if (l === current || pending) return;
    startTransition(() => {
      void setLocale(l);
    });
  };

  return (
    <div
      className={`flex items-center overflow-hidden rounded-md border border-green-900/40 text-sm font-bold ${
        pending ? "opacity-60" : ""
      }`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => choose("en")}
        aria-pressed={current === "en"}
        disabled={pending}
        suppressHydrationWarning
        className={`px-3 py-1 transition ${
          current === "en"
            ? "bg-green-800 text-yellow-300"
            : "hover:bg-green-900/10"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => choose("th")}
        aria-pressed={current === "th"}
        disabled={pending}
        suppressHydrationWarning
        className={`px-3 py-1 transition ${
          current === "th"
            ? "bg-green-800 text-yellow-300"
            : "hover:bg-green-900/10"
        }`}
      >
        TH
      </button>
    </div>
  );
}
