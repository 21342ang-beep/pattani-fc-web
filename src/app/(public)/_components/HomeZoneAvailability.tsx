import type { AggregatedZoneAvailability, DynamicZoneAvailability } from "@/lib/seat-availability";
import { STADIUM_ZONE_CODES, type StadiumZoneCode } from "@/lib/stadium-zones";
import type { Dict, Locale } from "@/lib/i18n/dict";
import { intlLocale } from "@/lib/i18n/text";

export default function HomeZoneAvailability({
  availability,
  dynamicZones,
  locale,
  labels,
}: {
  availability: Record<StadiumZoneCode, AggregatedZoneAvailability>;
  dynamicZones: DynamicZoneAvailability[];
  locale: Locale;
  labels: Dict["home"];
}) {
  const numberLocale = intlLocale(locale);

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
      {STADIUM_ZONE_CODES.map((code) => {
        const zone = availability[code];
        return (
          <div
            key={code}
            className="rounded-xl border border-green-100 bg-white p-4 text-center shadow-sm lg:px-2"
          >
            <p className="text-sm font-bold text-slate-600 sm:text-base lg:text-sm xl:text-base">{labels.zone} {code}</p>
            <p className="mt-1 text-3xl font-black text-green-900 sm:text-2xl lg:text-2xl xl:text-3xl">
              {zone.capacity == null ? "—" : zone.remaining.toLocaleString(numberLocale)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500 sm:text-xs xl:text-sm">
              {zone.capacity == null ? labels.notOpen : labels.seatsRemaining}
            </p>
          </div>
        );
      })}
      {dynamicZones.map((zone) => (
        <div
          key={zone.id}
          className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-center shadow-sm lg:px-2"
          title={`${zone.name} · ${zone.matchLabel}`}
        >
          <p className="truncate text-sm font-bold text-amber-800 sm:text-base lg:text-sm xl:text-base">
            {labels.zone} {zone.buttonLabel?.trim() || zone.code}
          </p>
          <p className="mt-1 text-3xl font-black text-green-900 sm:text-2xl lg:text-2xl xl:text-3xl">
            {zone.remaining.toLocaleString(numberLocale)}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500 sm:text-xs xl:text-sm">
            {labels.seatsRemaining}
          </p>
          <p className="mt-2 truncate text-xs font-semibold text-amber-700">{zone.name}</p>
        </div>
      ))}
    </div>
  );
}
