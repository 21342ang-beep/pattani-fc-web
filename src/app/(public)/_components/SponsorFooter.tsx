"use client";

import { useState } from "react";

type Sponsor = {
  id: string;
  name: string;
  logoUrl?: string;
};

export default function SponsorFooter({ sponsors }: { sponsors: Sponsor[] }) {
  const [selectedSponsor, setSelectedSponsor] = useState<string | null>(null);

  if (sponsors.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden border-b border-yellow-300/15 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.2),transparent_42%),linear-gradient(135deg,#052e1a,#064e3b_55%,#022c22)] py-10 text-yellow-100 md:py-12"
      aria-label="Official Partners"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(135deg,transparent_47%,#fff_48%,transparent_49%)] [background-size:22px_22px]"
      />
      <div className="relative mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-3 gap-x-5 gap-y-6 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {sponsors.map((sponsor) => {
            const selected = selectedSponsor === sponsor.id;
            return (
              <button
                key={sponsor.id}
                type="button"
                onClick={() => setSelectedSponsor(sponsor.id)}
                aria-pressed={selected}
                aria-label={`เลือก ${sponsor.name}`}
                className={`group flex aspect-[2.1/1] items-center justify-center px-1.5 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 ${
                  selected
                    ? "drop-shadow-[0_0_10px_rgba(253,224,71,0.35)]"
                    : ""
                }`}
              >
                {sponsor.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sponsor.logoUrl}
                    alt={sponsor.name}
                    loading="lazy"
                    className={`max-h-[92%] max-w-full object-contain transition duration-200 ${
                      selected
                        ? "scale-105 grayscale-0 opacity-100"
                        : "grayscale opacity-65 group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-100 group-focus-visible:grayscale-0 group-focus-visible:opacity-100"
                    }`}
                  />
                ) : (
                  <span
                    className={`text-center text-sm font-bold uppercase tracking-wide transition ${
                      selected
                        ? "text-yellow-200"
                        : "text-yellow-100/60 group-hover:text-yellow-100"
                    }`}
                  >
                    {sponsor.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
