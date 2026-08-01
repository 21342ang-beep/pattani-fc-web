import Image from "next/image";
import Link from "next/link";
import { ArrowDown, Calendar, MapPin, Shield } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ZoneAvailability } from "@/lib/seat-availability";
import { STADIUM_ZONE_CODES, type StadiumZoneCode } from "@/lib/stadium-zones";

export type OnSaleMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  kickoffAt: Date | string | null;
  venue: string | null;
};

export default function OnSaleMatchBoard({
  match,
  showBookingButton = true,
  zoneAvailability,
}: {
  match: OnSaleMatch;
  showBookingButton?: boolean;
  zoneAvailability?: Record<StadiumZoneCode, ZoneAvailability>;
}) {
  return (
    <article className="overflow-hidden rounded-2xl bg-green-950 bg-[linear-gradient(rgba(0,56,24,0.18),rgba(0,56,24,0.36)),url('/booking-background.png')] bg-[length:200%_auto] bg-[position:22%_-10%] bg-no-repeat text-white shadow-xl md:bg-[length:100%_100%] md:bg-center">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-1.5 text-base font-black uppercase tracking-wider text-green-950 sm:text-lg">
            <span className="size-2 animate-pulse rounded-full bg-green-950" />
            เปิดจองแล้ว
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-7">
            <Team logo={match.homeTeamLogo} name={match.homeTeam} />
            <span className="invisible text-3xl font-black tracking-[0.2em] sm:text-4xl" aria-hidden>VS</span>
            <Team logo={match.awayTeamLogo} name={match.awayTeam} />
          </div>
        </div>

        <div className="border-t border-white/20 pt-5 md:min-w-60 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <p className="flex items-center gap-2 text-lg text-emerald-100 sm:text-xl">
            <Calendar className="size-4 text-yellow-300" />
            {match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg text-emerald-100 sm:text-xl">
            <MapPin className="size-4 text-yellow-300" />
            {match.venue ?? "ยังไม่กำหนดสนาม"}
          </p>
          {showBookingButton ? (
            <Link
              href="/tickets#matches"
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-yellow-300 px-5 py-3.5 text-xl font-black text-green-950 transition hover:bg-yellow-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
            >
              จองตั๋วตอนนี้
            </Link>
          ) : (
            <p className="mt-6 flex items-center gap-2 text-2xl font-black leading-snug text-yellow-300 sm:text-3xl">
              เลือกโซนที่นั่งและจองด้านล่างนี้
              <ArrowDown className="size-6 shrink-0 animate-bounce" aria-hidden />
            </p>
          )}
        </div>
      </div>
      {zoneAvailability && (
        <div className="border-t border-white/15 bg-black/15 px-5 py-4 sm:px-8">
          <p className="mb-4 text-base font-semibold text-emerald-100 sm:text-lg lg:text-xl">ที่นั่งคงเหลือแยกตามโซน (หักสิทธิ์บัตรรายปีแล้ว)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-10">
            {STADIUM_ZONE_CODES.map((code) => {
              const zone = zoneAvailability[code];
              return (
                <Link
                  key={code}
                  href={`/matches/${match.id}?zone=${code}`}
                  className="group rounded-lg bg-white/10 px-3 py-3 text-center transition hover:bg-yellow-300 hover:text-green-950"
                >
                  <span className="block text-sm font-bold sm:text-base">โซน {code}</span>
                  <span className="mt-1 block text-2xl font-black sm:text-xl lg:text-2xl">
                    {zone.capacity == null ? "—" : zone.remaining.toLocaleString("th-TH")}
                  </span>
                  <span className="block text-xs font-medium text-emerald-100 group-hover:text-green-950 sm:text-sm">ที่นั่ง</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

function Team({ logo, name }: { logo: string | null; name: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 text-center">
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg sm:size-28">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={112}
            height={112}
            unoptimized
            className="size-full object-contain"
          />
        ) : (
          <Shield className="size-9 text-slate-300" />
        )}
      </div>
      <h3 className="line-clamp-2 text-xl font-black sm:text-3xl">{name}</h3>
    </div>
  );
}
