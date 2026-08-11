"use client";

import { Megaphone, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export default function SeasonPassAnnouncementModal({
  children,
  className,
  initiallyOpen = false,
  ticketType = "season",
}: {
  children?: ReactNode;
  className?: string;
  initiallyOpen?: boolean;
  ticketType?: "match" | "season";
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const isMatchTicket = ticketType === "match";
  const titleId = `${ticketType}-booking-announcement-title`;
  const descriptionId = `${ticketType}-booking-announcement-description`;

  return (
    <>
      {children && (
        <button type="button" onClick={() => setIsOpen(true)} className={className}>
          {children}
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <section className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-yellow-300/40 bg-white shadow-2xl">
            <div className="h-2 bg-gradient-to-r from-green-800 via-yellow-400 to-green-800" />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="ปิดประกาศ"
              className="absolute right-4 top-5 grid size-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="size-5" aria-hidden="true" />
            </button>

            <div className="px-6 pb-7 pt-8 text-center sm:px-10 sm:pb-9 sm:pt-10">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-yellow-100 text-yellow-700 ring-8 ring-yellow-50">
                <Megaphone className="size-8" aria-hidden="true" />
              </div>
              <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-yellow-700 sm:text-base">
                ประกาศสำคัญจากสโมสร
              </p>
              <h2
                id={titleId}
                className="mt-2 text-3xl font-black leading-tight text-green-950 sm:text-4xl"
              >
                {isMatchTicket
                  ? "ขณะนี้ยังไม่เปิดจองตั๋วรายแมตช์"
                  : "ขณะนี้ยังไม่เปิดจองตั๋วรายปี"}
              </h2>
              <p
                id={descriptionId}
                className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-slate-600 sm:text-xl"
              >
                กรุณารอประกาศการเปิดจองอย่างเป็นทางการจากสโมสรปัตตานี เอฟซี
              </p>
              <p className="mt-2 text-base text-slate-500 sm:text-lg">
                ขออภัยในความไม่สะดวก
              </p>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-green-800 px-7 py-3 text-xl font-black text-yellow-300 transition hover:bg-green-900 focus:outline-none focus:ring-4 focus:ring-green-800/25 sm:w-auto sm:min-w-48"
              >
                รับทราบ
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
