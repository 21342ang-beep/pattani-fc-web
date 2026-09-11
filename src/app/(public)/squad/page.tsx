import Image from "next/image";
import { payload } from "@/lib/payload";
import { getT } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/text";
import type { Locale } from "@/lib/i18n/dict";

export const revalidate = 300;
export const metadata = { title: "ผู้เล่นและสตาฟ — Pattani FC" };

const POSITION_LABEL: Record<string, string> = {
  GK: "ผู้รักษาประตู",
  DF: "กองหลัง",
  MF: "กองกลาง",
  FW: "กองหน้า",
};

const STAFF_ROLE_LABEL: Record<string, string> = {
  "head-coach": "หัวหน้าผู้ฝึกสอน",
  "asst-coach": "ผู้ช่วยผู้ฝึกสอน",
  "gk-coach": "โค้ชผู้รักษาประตู",
  physio: "นักกายภาพ",
  "team-manager": "ผู้ดูแลทีม",
  other: "อื่นๆ",
};

export default async function SquadPage() {
  const cms = await payload();
  const [playersRes, staffRes, { locale }] = await Promise.all([
    cms.find({
      collection: "players",
      where: { active: { equals: true } },
      sort: "jerseyNumber",
      limit: 100,
      depth: 1,
      overrideAccess: true,
    }),
    cms.find({
      collection: "staff",
      limit: 50,
      overrideAccess: true,
    }),
    getT(),
  ]);
  const t = (th: string, en: string) => localize(locale, th, en);

  const players = playersRes.docs as unknown as PlayerDoc[];
  const staff = staffRes.docs as unknown as StaffDoc[];

  const grouped: Record<string, PlayerDoc[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of players) {
    if (grouped[p.position]) grouped[p.position].push(p);
  }

  return (
    <main className="bg-white">
      <header className="border-b border-green-900/15 bg-green-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="text-sm font-semibold uppercase tracking-wider text-yellow-300">
            Pattani FC
          </p>
          <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
            {t("ผู้เล่นและสตาฟ", "Players & Staff")}
          </h1>
          <p className="mt-2 max-w-2xl text-lg text-green-100 md:text-xl">
            {t("นักเตะชุดใหญ่และทีมงานสตาฟโค้ชของปัตตานี เอฟซี", "Pattani FC first-team players and coaching staff")}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 md:space-y-20 md:py-14">
        {(Object.keys(POSITION_LABEL) as Array<keyof typeof POSITION_LABEL>).map(
          (pos) => {
            const list = grouped[pos];
            if (!list || list.length === 0) return null;
            return (
              <section key={pos}>
                <div className="mb-6 flex items-end justify-between gap-3 border-b border-green-900/20 pb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-green-700">
                      {pos}
                    </p>
                    <h2 className="text-2xl font-black text-green-950 md:text-3xl">
                      {positionLabel(pos, locale)}
                    </h2>
                  </div>
                  <span className="text-sm font-semibold text-slate-500">
                    {list.length} {t("คน", "players")}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
                  {list.map((p) => (
                    <li key={String(p.id)}>
                      <PlayerCard player={p} locale={locale} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          }
        )}

        {players.length === 0 && (
          <div className="border border-dashed border-slate-300 py-12 text-center text-slate-500">
            {t("ยังไม่มีข้อมูลผู้เล่นในระบบ", "No player information is available")}
          </div>
        )}

        {staff.length > 0 && (
          <section>
            <div className="mb-6 border-b border-green-900/20 pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-green-700">
                Staff
              </p>
              <h2 className="text-2xl font-black text-green-950 md:text-3xl">
                {t("ทีมงานสตาฟ", "Coaching Staff")}
              </h2>
            </div>
            <ul className="grid gap-x-5 gap-y-6 sm:grid-cols-2 md:grid-cols-3">
              {staff.map((s) => (
                <li key={String(s.id)}>
                  <article className="flex items-center gap-3 border-b border-slate-200 pb-4">
                    <div className="relative size-16 shrink-0 overflow-hidden bg-slate-100">
                      {s.photoUrl && (
                        <Image
                          src={s.photoUrl}
                          alt={s.name}
                          fill
                          unoptimized
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-green-950">{s.name}</p>
                      <p className="text-sm text-slate-500">
                        {staffRoleLabel(s.role, locale)}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function PlayerCard({ player: p, locale }: { player: PlayerDoc; locale: Locale }) {
  const photoUrl = mediaUrl(p.photo);
  return (
    <article className="h-full bg-white">
      <div className="relative aspect-[4/5] overflow-hidden bg-white">
        <div className="absolute inset-0">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={p.name}
              fill
              unoptimized={!photoUrl.startsWith("/payload-api/media/file/")}
              sizes="(min-width: 1152px) 265px, (min-width: 768px) 33vw, 50vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl font-black text-green-900/40">
              {p.name.slice(0, 1)}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 border-t border-green-900/15 pt-3">
        {p.jerseyNumber !== undefined && (
          <span className="shrink-0 text-xl font-black text-green-800 md:text-2xl">
            {p.jerseyNumber}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-lg font-black leading-tight text-green-950 md:text-xl">
            {p.name}
          </h3>
          <p className="text-xs text-slate-500 md:text-sm">
            {positionLabel(p.position, locale)}
          </p>
          {p.nationality && (
            <p className="text-xs text-slate-500 md:text-sm">
              {p.nationality}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function positionLabel(position: string, locale: Locale) {
  if (locale === "th") return POSITION_LABEL[position] ?? position;
  if (locale === "ms") return ({ GK: "Penjaga Gol", DF: "Pemain Pertahanan", MF: "Pemain Tengah", FW: "Penyerang" } as Record<string, string>)[position] ?? position;
  return ({ GK: "Goalkeeper", DF: "Defender", MF: "Midfielder", FW: "Forward" } as Record<string, string>)[position] ?? position;
}

function staffRoleLabel(role: string, locale: Locale) {
  if (locale === "th") return STAFF_ROLE_LABEL[role] ?? role;
  if (locale === "ms") return ({ "head-coach": "Ketua Jurulatih", "asst-coach": "Penolong Jurulatih", "gk-coach": "Jurulatih Penjaga Gol", physio: "Ahli Fisioterapi", "team-manager": "Pengurus Pasukan", other: "Lain-lain" } as Record<string, string>)[role] ?? role;
  return ({ "head-coach": "Head Coach", "asst-coach": "Assistant Coach", "gk-coach": "Goalkeeper Coach", physio: "Physiotherapist", "team-manager": "Team Manager", other: "Other" } as Record<string, string>)[role] ?? role;
}

type PlayerDoc = {
  id: string | number;
  name: string;
  jerseyNumber?: number;
  position: "GK" | "DF" | "MF" | "FW";
  nationality?: string;
  photo?: { filename?: string | null; url?: string | null } | string | number | null;
};

function mediaUrl(media: PlayerDoc["photo"]) {
  if (typeof media !== "object" || media === null) return undefined;

  const filename = media.filename?.trim();
  // This route can read new uploads without rebuilding Next's public file list.
  if (filename) return `/payload-api/media/file/${encodeURIComponent(filename)}`;

  return media.url ?? undefined;
}

type StaffDoc = {
  id: string | number;
  name: string;
  role: string;
  photoUrl?: string;
};
