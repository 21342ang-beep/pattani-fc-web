import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, MapPin, Shield, Ticket } from "lucide-react";
import { getMatchesByFilter } from "@/lib/cached-queries";
import { formatDateTime } from "@/lib/format";

const ALLOWED_FILTERS = ["all", "on_sale", "upcoming"] as const;
type Filter = (typeof ALLOWED_FILTERS)[number];
const ALLOWED_COMPETITIONS = ["all", "league", "cup"] as const;
type CompetitionFilter = (typeof ALLOWED_COMPETITIONS)[number];

// whitelist โซน — กัน XSS ผ่าน URL ตอน thread ต่อไปยัง match detail
const ALLOWED_ZONES = [
  "A", "B", "C", "D", "E", "F", "G", "I", "J", "AWAY",
] as const;

export default async function MatchesListPage(props: {
  searchParams: Promise<{ filter?: string; zone?: string; competition?: string }>;
}) {
  const { filter: raw, zone: zoneRaw, competition: competitionRaw } = await props.searchParams;
  const filter: Filter = (ALLOWED_FILTERS as readonly string[]).includes(raw ?? "")
    ? (raw as Filter)
    : "all";
  const zone = (ALLOWED_ZONES as readonly string[]).includes(zoneRaw ?? "")
    ? zoneRaw
    : undefined;
  const zoneQS = zone ? `?zone=${zone}` : "";
  const competition: CompetitionFilter = (ALLOWED_COMPETITIONS as readonly string[]).includes(competitionRaw ?? "")
    ? (competitionRaw as CompetitionFilter)
    : "all";
  const competitionType = competition === "all" ? undefined : competition === "league" ? "LEAGUE" : "CUP";

  const [matches, onSaleMatches] = await Promise.all([
    getMatchesByFilter(filter, competitionType),
    getMatchesByFilter("on_sale", competitionType),
  ]);
  // เลือกโซนแล้วมีแมตช์ที่เปิดขายเพียงรายการเดียว → ข้ามหน้ากดจอง
  // และไปยังฟอร์มกรอกข้อมูลของแมตช์นั้นทันที
  if (zone && onSaleMatches.length === 1) {
    redirect(`/matches/${onSaleMatches[0].id}?zone=${zone}`);
  }
  const listMatches =
    filter === "all" || filter === "upcoming"
      ? matches.filter((match) => match.status !== "ON_SALE")
      : [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 md:space-y-10 md:py-16">
      <header>
        <h1 className="text-3xl font-black text-green-950 sm:text-4xl md:text-5xl">ตารางแข่งขัน</h1>
        <p className="mt-2 text-lg text-slate-600 sm:text-xl md:text-2xl">
          เลือกแมตช์ที่สนใจเพื่อจองตั๋ว
          {zone && (
            <>
              {" — โซนที่เลือก: "}
              <span className="rounded-full bg-yellow-400 px-3 py-1 text-base font-bold text-green-950 md:text-lg">
                {zone}
              </span>
            </>
          )}
        </p>
      </header>

      {onSaleMatches.length > 0 && (
        <section aria-labelledby="on-sale-heading">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 md:size-12">
              <Ticket className="size-5 md:size-6" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-700 md:text-base">Book now</p>
              <h2 id="on-sale-heading" className="text-2xl font-black text-green-950 md:text-3xl">
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

      <nav className="flex flex-wrap items-center gap-3">
        <FilterTab href={competition === "all" ? "/matches" : `/matches?competition=${competition}`} active={filter === "all"} label="โปรแกรมการแข่งขัน" />
        <FilterTab href={`/matches?filter=on_sale${competition === "all" ? "" : `&competition=${competition}`}`} active={filter === "on_sale"} label="เปิดจอง" />
        <FilterTab href={`/matches?filter=upcoming${competition === "all" ? "" : `&competition=${competition}`}`} active={filter === "upcoming"} label="กำลังจะมาถึง" />
        <form action="/matches" className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <label htmlFor="competition" className="sr-only">ประเภทการแข่งขัน</label>
          <select id="competition" name="competition" defaultValue={competition} className="min-w-0 flex-1 rounded-md border bg-white px-4 py-2.5 text-base text-slate-700 sm:flex-none md:text-lg">
            <option value="all">ทั้งหมด</option>
            <option value="league">บอลลีก</option>
            <option value="cup">บอลถ้วย</option>
          </select>
          <button type="submit" className="rounded-md border border-slate-300 px-4 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-100 md:text-lg">แสดง</button>
        </form>
      </nav>

      {listMatches.length === 0 && onSaleMatches.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-lg text-slate-500 md:text-xl">
          ไม่พบแมตช์ในหมวดนี้
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listMatches.map((m) => {
            const isOnSale = m.status === "ON_SALE";
            const isPattaniHomeMatch = isPattaniHomeTeam(m.homeTeam);
            return (
              <li key={m.id} className="flex flex-col rounded-xl border bg-white p-5 shadow-sm md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <StatusBadge status={m.status} />
                  <span className="text-sm text-slate-500 md:text-base">
                    {m.kickoffAt ? formatDateTime(m.kickoffAt) : "ยังไม่กำหนด"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <TeamCrest logo={m.homeTeamLogo} name={m.homeTeam} />
                  <span className="text-base font-bold uppercase tracking-widest text-yellow-600 md:text-lg">
                    VS
                  </span>
                  <TeamCrest logo={m.awayTeamLogo} name={m.awayTeam} />
                </div>
                <p className="mt-3 text-center text-base text-slate-600 md:text-lg">{m.venue ?? "ยังไม่กำหนดสนาม"}</p>
                {isPattaniHomeMatch && (
                  <div className="mt-auto pt-4">
                    <div className="mb-3 text-base font-semibold md:text-lg">
                      ราคาแยกตามโซน
                    </div>
                    <Link
                      href={`/matches/${m.id}${zoneQS}`}
                      className={`block w-full rounded-md px-4 py-3 text-center text-base font-semibold md:text-lg ${
                        isOnSale
                          ? "bg-slate-900 text-white hover:bg-slate-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {isOnSale ? "จองตั๋ว" : "ดูรายละเอียด"}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function isPattaniHomeTeam(teamName: string) {
  const normalized = teamName.trim().toLocaleLowerCase("th-TH");
  return normalized.includes("pattani") || normalized.includes("ปัตตานี");
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
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-black uppercase tracking-wider text-green-950 md:text-base">
            <span className="size-2 animate-pulse rounded-full bg-green-950" /> เปิดจองแล้ว
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-7">
            <MainboardTeam logo={match.homeTeamLogo} name={match.homeTeam} />
            <span className="text-xl font-black tracking-[0.2em] text-yellow-300 sm:text-3xl">VS</span>
            <MainboardTeam logo={match.awayTeamLogo} name={match.awayTeam} />
          </div>
        </div>
        <div className="border-t border-white/20 pt-5 md:min-w-60 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <p className="flex items-center gap-2 text-base text-emerald-100 md:text-lg">
            <Calendar className="size-5 text-yellow-300" />
            {match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}
          </p>
          <p className="mt-3 flex items-center gap-2 text-base text-emerald-100 md:text-lg">
            <MapPin className="size-5 text-yellow-300" />
            {match.venue ?? "ยังไม่กำหนดสนาม"}
          </p>
          <p className="mt-5 text-base text-emerald-100 md:text-lg">เริ่มต้น</p>
          <p className="text-3xl font-black text-yellow-300 md:text-4xl">
            ราคาแยกตามโซน
          </p>
          <Link
            href={zoneQS ? `/matches/${match.id}${zoneQS}` : "/tickets"}
            className="mt-5 block rounded-lg bg-yellow-300 px-5 py-3.5 text-center text-base font-bold text-green-950 transition hover:bg-yellow-200 md:text-lg"
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
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg sm:size-28 md:size-32">
        {logo ? (
          <Image src={logo} alt={name} width={112} height={112} unoptimized className="size-full object-contain" />
        ) : (
          <Shield className="size-10 text-slate-300" />
        )}
      </div>
      <h3 className="line-clamp-2 text-lg font-black sm:text-xl md:text-2xl">{name}</h3>
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
      className={`rounded-md px-4 py-2.5 text-base font-semibold md:text-lg ${
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
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm md:size-24">
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
          <Shield className="size-8 text-slate-300" />
        )}
      </div>
      <span className="line-clamp-2 max-w-[9rem] text-center text-sm font-semibold text-green-900 md:text-base">
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
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold md:text-base ${s.cls}`}>{s.label}</span>;
}
