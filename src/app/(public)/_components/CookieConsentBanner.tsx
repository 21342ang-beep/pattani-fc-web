"use client";

import Link from "next/link";
import { Cookie, Loader2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { saveCookieConsent } from "@/app/actions/cookie-consent";
import type { Locale } from "@/lib/i18n/dict";

const copy = {
  th: {
    title: "การใช้คุกกี้บนเว็บไซต์",
    description:
      "เราใช้คุกกี้ที่จำเป็นเพื่อให้ระบบเข้าสู่ระบบ จองตั๋ว และความปลอดภัยทำงาน และใช้คุกกี้เพิ่มเติมเพื่อปรับปรุงบริการเมื่อคุณยอมรับ",
    privacy: "อ่านนโยบายความเป็นส่วนตัว",
    necessary: "เฉพาะคุกกี้ที่จำเป็น",
    acceptAll: "ยอมรับทั้งหมด",
    saving: "กำลังบันทึก...",
    error: "บันทึกตัวเลือกไม่สำเร็จ กรุณาลองอีกครั้ง",
  },
  en: {
    title: "Cookie preferences",
    description:
      "We use essential cookies for sign-in, ticket booking, and security. With your consent, additional cookies may be used to improve our services.",
    privacy: "Read our Privacy Policy",
    necessary: "Essential cookies only",
    acceptAll: "Accept all",
    saving: "Saving...",
    error: "Your preference could not be saved. Please try again.",
  },
  ms: {
    title: "Pilihan kuki",
    description:
      "Kami menggunakan kuki penting untuk log masuk, tempahan tiket dan keselamatan. Dengan persetujuan anda, kuki tambahan boleh digunakan untuk menambah baik perkhidmatan.",
    privacy: "Baca Dasar Privasi",
    necessary: "Kuki penting sahaja",
    acceptAll: "Terima semua",
    saving: "Menyimpan...",
    error: "Pilihan anda tidak dapat disimpan. Sila cuba lagi.",
  },
} satisfies Record<Locale, Record<string, string>>;

export default function CookieConsentBanner({
  locale,
}: {
  locale: Locale;
}) {
  const text = copy[locale];
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function choose(value: "all-v1" | "necessary-v1") {
    setError("");
    startTransition(async () => {
      const result = await saveCookieConsent(value).catch(() => ({ ok: false }));
      if (result.ok) {
        setVisible(false);
      } else {
        setError(text.error);
      }
    });
  }

  if (!visible) return null;

  return (
    <section
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-yellow-300/30 bg-green-950 p-4 text-yellow-50 shadow-2xl shadow-black/30 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-yellow-400 text-green-950">
              <Cookie className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="cookie-consent-title" className="text-lg font-black sm:text-xl">
                {text.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-yellow-50/80 sm:text-base">
                {text.description}{" "}
                <Link
                  href="/privacy-policy"
                  className="font-bold text-yellow-300 underline decoration-yellow-300/50 underline-offset-2 hover:text-yellow-200"
                >
                  {text.privacy}
                </Link>
              </p>
              {error && (
                <p role="alert" className="mt-2 text-sm font-semibold text-red-300">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:min-w-[22rem]">
            <button
              type="button"
              onClick={() => choose("necessary-v1")}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-yellow-200/50 px-4 py-3 text-sm font-bold text-yellow-100 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60 sm:text-base"
            >
              <ShieldCheck className="size-4" aria-hidden />
              {pending ? text.saving : text.necessary}
            </button>
            <button
              type="button"
              onClick={() => choose("all-v1")}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-3 text-sm font-black text-green-950 transition hover:bg-yellow-300 disabled:cursor-wait disabled:opacity-60 sm:text-base"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {pending ? text.saving : text.acceptAll}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
