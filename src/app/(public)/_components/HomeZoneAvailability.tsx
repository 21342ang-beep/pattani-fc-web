import Link from "next/link";
import type { AggregatedZoneAvailability } from "@/lib/seat-availability";
import { STADIUM_ZONE_CODES, STADIUM_ZONES, type StadiumZoneCode } from "@/lib/stadium-zones";

export default function HomeZoneAvailability({
  availability,
}: {
  availability: Record<StadiumZoneCode, AggregatedZoneAvailability>;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
      {STADIUM_ZONE_CODES.map((code) => {
        const zone = availability[code];
        return (
          <Link
            key={code}
            href={`/matches?zone=${code}`}
            className="rounded-xl border border-green-100 bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md lg:px-2"
          >
            <p className="text-sm font-bold text-slate-600 sm:text-base lg:text-sm xl:text-base">โซน {code}</p>
            <p className="mt-1 text-3xl font-black text-green-900 sm:text-2xl lg:text-2xl xl:text-3xl">
              {zone.capacity == null ? "—" : zone.remaining.toLocaleString("th-TH")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500 sm:text-xs xl:text-sm">
              {zone.capacity == null ? "ยังไม่เปิด" : "ที่นั่งคงเหลือ"}
            </p>
            {zone.seasonReserved > 0 && (
              <p className="mt-1 text-xs font-semibold text-amber-700 xl:text-sm">รายปี {zone.seasonReserved}</p>
            )}
            <span className="sr-only">{STADIUM_ZONES[code].label}</span>
          </Link>
        );
      })}
    </div>
  );
}
