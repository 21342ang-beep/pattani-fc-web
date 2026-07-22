import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";

export type HomePlayer = {
  id: string | number;
  name: string;
  jerseyNumber?: number | null;
  position: "GK" | "DF" | "MF" | "FW";
  photo?: { url?: string | null } | string | number | null;
};

const positionLabel: Record<HomePlayer["position"], string> = {
  GK: "ผู้รักษาประตู",
  DF: "กองหลัง",
  MF: "กองกลาง",
  FW: "กองหน้า",
};

const positionTone: Record<HomePlayer["position"], string> = {
  GK: "from-amber-300 to-yellow-500",
  DF: "from-sky-300 to-blue-600",
  MF: "from-emerald-300 to-green-600",
  FW: "from-rose-300 to-red-600",
};

export default function HomePlayers({ players }: { players: HomePlayer[] }) {
  if (players.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-green-950 px-5 py-8 text-white sm:px-8 sm:py-10">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(90deg,rgba(255,255,255,.45)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:34px_34px]"
      />
      <div aria-hidden className="absolute -right-20 -top-24 size-80 rounded-full bg-yellow-300/15 blur-3xl" />

      <div className="relative">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-300">Our squad</p>
            <h2 className="mt-1 text-3xl font-black sm:text-4xl">ผู้เล่นปัตตานี เอฟซี</h2>
          </div>
          <Link
            href="/squad"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-300/35 px-4 py-2 text-sm font-bold text-yellow-200 transition hover:bg-yellow-300 hover:text-green-950"
          >
            ดูทีมทั้งหมด <ArrowRight className="size-4" />
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {players.map((player) => (
            <li key={String(player.id)}>
              <PlayerSpotlight player={player} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PlayerSpotlight({ player }: { player: HomePlayer }) {
  const photoUrl = mediaUrl(player.photo);
  const number = player.jerseyNumber?.toString().padStart(2, "0") ?? "--";

  return (
    <article className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-green-800 to-green-950 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40">
      <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${positionTone[player.position]}`} />
      <span aria-hidden className="absolute -right-2 top-1 select-none text-7xl font-black leading-none text-white/[0.08] sm:text-8xl">
        {number}
      </span>
      <span className="absolute left-3 top-4 rounded-full bg-black/25 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-200 backdrop-blur-sm">
        {positionLabel[player.position]}
      </span>

      <div className="absolute inset-x-3 bottom-12 top-9 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_20%,rgba(250,204,21,.26),transparent_55%)]">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={player.name}
            fill
            unoptimized
            sizes="(min-width: 640px) 25vw, 50vw"
            className="object-cover object-top transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-yellow-200/45">
            <Shield className="size-16" />
          </div>
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-green-950 to-transparent" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-green-900 px-3 py-2.5">
        <span className="text-2xl font-black text-yellow-300">{number}</span>
        <h3 className="line-clamp-1 text-sm font-black sm:text-base">{player.name}</h3>
      </div>
    </article>
  );
}

function mediaUrl(media: HomePlayer["photo"]) {
  return typeof media === "object" && media !== null && "url" in media
    ? media.url ?? undefined
    : undefined;
}
