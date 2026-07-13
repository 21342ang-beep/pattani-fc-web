import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Shield, Ticket } from "lucide-react";
import { getMatchesByFilter } from "@/lib/cached-queries";
import { formatBaht, formatDateTime } from "@/lib/format";

const ALLOWED_FILTERS = ["all", "on_sale", "upcoming"] as const;
type Filter = (typeof ALLOWED_FILTERS)[number];

// whitelist โซน — กัน XSS ผ่าน URL ตอน thread ต่อไปยัง match detail
const ALLOWED_ZONES = [
  "N1", "N2", "S", "S1", "S2", "W", "E", "AWAY",
] as const;

export default async function MatchesListPage(props: {
  searchParams: Promise<{ filter?: string; zone?: string }>;
}) {
  const { filter: raw, zone: zoneRaw } = await props.searchParams;
  const filter: Filter = (ALLOWED_FILTERS as readonly string[]).includes(raw ?? "")
    ? (raw as Filter)
    : "all";
  const zone = (ALLOWED_ZONES as readonly string[]).includes(zoneRaw ?? "")
    ? zoneRaw
    : undefined;
  const zoneQS = zone ? `?zone=${zone}` : "";

  const [matches, onSaleMatches] = await Promise.all([
    getMatchesByFilter(filter),
    getMatchesByFilter("on_sale"),
  ]);
  const listMatches =
    filter === "all" || filter === "upcoming"
      ? matches.filter((match) => match.status !== "ON_SALE")
      : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ตารางแข่งขัน</h1>
        <p className="text-sm text-slate-600">
          เลือกแมตช์ที่สนใจเพื่อจองตั๋ว
          {zone && (
            <>
              {" — โซนที่เลือก: "}
              <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-green-950">
                {zone}
              </span>
            </>
          )}
        </p>
      </header>

      {onSaleMatches.length > 0 && (
        <section aria-labelledby="on-sale-heading">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Ticket className="size-4" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Book now</p>
              <h2 id="on-sale-heading" className="text-xl font-black text-green-950">
                โปรแกรมที่เปิดจอง
              </h2>
            </div>
          </div>
          <div className="space-y-4">
            {onSaleMatches.map((match) => (
              <OnSaleMainboard key={match.id} match={match} zoneQS={zoneQS} />
            ))}
          </div>
        </section>
      )}

      <nav className="flex gap-2">
        <FilterTab href="/matches" active={filter === "all"} label="ทั้งหมด" />
        <FilterTab href="/matches?filter=on_sale" active={filter === "on_sale"} label="เปิดจอง" />
        <FilterTab href="/matches?filter=upcoming" active={filter === "upcoming"} label="กำลังจะมาถึง" />
      </nav>

      {listMatches.length === 0 && onSaleMatches.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
          ไม่พบแมตช์ในหมวดนี้
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listMatches.map((m) => {
            const isOnSale = m.status === "ON_SALE";
            return (
              <li key={m.id} className="flex flex-col rounded-lg border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <StatusBadge status={m.status} />
                  <span className="text-xs text-slate-500">
                    {m.kickoffAt ? formatDateTime(m.kickoffAt) : "ยังไม่กำหนด"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-2">
                  <TeamCrest logo={m.homeTeamLogo} name={m.homeTeam} />
                  <span className="text-sm font-bold uppercase tracking-widest text-yellow-600">
                    VS
                  </span>
                  <TeamCrest logo={m.awayTeamLogo} name={m.awayTeam} />
                </div>
                <p className="mt-2 text-center text-sm text-slate-600">{m.venue ?? "ยังไม่กำหนดสนาม"}</p>
                <div className="mt-auto pt-4">
                  <div className="mb-2 text-sm font-medium">
                    {m.pricePerSeat != null ? `${formatBaht(m.pricePerSeat)}/ใบ` : "ราคารอประกาศ"}
                  </div>
                  <Link
                    href={`/matches/${m.id}${zoneQS}`}
                    className={`block w-full rounded-md px-3 py-2 text-center text-sm font-medium ${
                      isOnSale
                        ? "bg-slate-900 text-white hover:bg-slate-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {isOnSale ? "จองตั๋ว" : "ดูรายละเอียด"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OnSaleMainboard({
  match,
  zoneQS,
}: {
  match: Awaited<ReturnType<typeof getMatchesByFilter>>[number];
  zoneQS: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 text-white shadow-xl">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-green-950">
            <span className="size-2 animate-pulse rounded-full bg-green-950" /> เปิดจองแล้ว
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-7">
            <MainboardTeam logo={match.homeTeamLogo} name={match.homeTeam} />
            <span className="text-lg font-black tracking-[0.2em] text-yellow-300 sm:text-2xl">VS</span>
            <MainboardTeam logo={match.awayTeamLogo} name={match.awayTeam} />
          </div>
        </div>
        <div className="border-t border-white/20 pt-5 md:min-w-60 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <p className="flex items-center gap-2 text-sm text-emerald-100">
            <Calendar className="size-4 text-yellow-300" />
            {match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-emerald-100">
            <MapPin className="size-4 text-yellow-300" />
            {match.venue ?? "ยังไม่กำหนดสนาม"}
          </p>
          <p className="mt-5 text-sm text-emerald-100">เริ่มต้น</p>
          <p className="text-2xl font-black text-yellow-300">
            {match.pricePerSeat != null ? `${formatBaht(match.pricePerSeat)}/ใบ` : "รอประกาศราคา"}
          </p>
          <Link
            href={`/matches/${match.id}${zoneQS}`}
            className="mt-5 block rounded-lg bg-yellow-300 px-5 py-3 text-center text-sm font-bold text-green-950 transition hover:bg-yellow-200"
          >
            จองตั๋วตอนนี้
          </Link>
        </div>
      </div>
    </article>
  );
}

function MainboardTeam({ logo, name }: { logo: string | null; name: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 text-center">
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg sm:size-28">
        {logo ? (
          <Image src={logo} alt={name} width={112} height={112} unoptimized className="size-full object-contain" />
        ) : (
          <Shield className="size-9 text-slate-300" />
        )}
      </div>
      <h3 className="line-clamp-2 text-base font-black sm:text-xl">{name}</h3>
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}

function TeamCrest({ logo, name }: { logo: string | null; name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={64}
            height={64}
            unoptimized
            className="size-full object-contain p-1"
          />
        ) : (
          <Shield className="size-7 text-slate-300" />
        )}
      </div>
      <span className="line-clamp-2 max-w-[8rem] text-center text-xs font-semibold text-green-900">
        {name}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SCHEDULED: { label: "ใกล้เปิด", cls: "bg-slate-100 text-slate-600" },
    ON_SALE: { label: "เปิดจอง", cls: "bg-emerald-100 text-emerald-700" },
    SOLD_OUT: { label: "เต็ม", cls: "bg-amber-100 text-amber-700" },
    FINISHED: { label: "จบแล้ว", cls: "bg-slate-100 text-slate-500" },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>;
}
