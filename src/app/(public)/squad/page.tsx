import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { payload } from "@/lib/payload";
import PageHero from "../_components/PageHero";
import { getT } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/text";
import type { Locale } from "@/lib/i18n/dict";

const POSITION_ACCENT: Record<string, string> = {
  GK: "from-amber-400 via-yellow-400 to-yellow-500",
  DF: "from-sky-400 via-blue-500 to-blue-600",
  MF: "from-emerald-400 via-green-500 to-green-600",
  FW: "from-rose-400 via-red-500 to-red-600",
};

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
    <>
      <PageHero
        title={t("ผู้เล่นและสตาฟ", "Players & Staff")}
        subtitle={t("นักเตะชุดใหญ่และทีมงานสตาฟโค้ชของปัตตานี เอฟซี", "Pattani FC first-team players and coaching staff")}
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        {(Object.keys(POSITION_LABEL) as Array<keyof typeof POSITION_LABEL>).map(
          (pos) => {
            const list = grouped[pos];
            if (!list || list.length === 0) return null;
            return (
              <section key={pos}>
                <div className="mb-5 flex items-end justify-between gap-3 border-b-2 border-green-900/10 pb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center justify-center rounded-md bg-gradient-to-br ${POSITION_ACCENT[pos]} px-2.5 py-1 text-[11px] font-black tracking-widest text-green-950 shadow-sm`}
                    >
                      {pos}
                    </span>
                    <h2 className="text-xl font-black text-green-900 md:text-2xl">
                      {positionLabel(pos, locale)}
                    </h2>
                  </div>
                  <span className="rounded-full bg-green-900 px-3 py-1 text-xs font-bold text-yellow-300">
                    {list.length} {t("คน", "players")}
                  </span>
                </div>
                <ul className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("ยังไม่มีข้อมูลผู้เล่นในระบบ", "No player information is available")}
            </CardContent>
          </Card>
        )}

        {staff.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold text-green-900">{t("ทีมงานสตาฟ", "Coaching Staff")}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {staff.map((s) => (
                <li key={String(s.id)}>
                  <Card className="flex flex-row items-center gap-3 p-4">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-green-100">
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
                    <div>
                      <p className="font-semibold text-green-900">{s.name}</p>
                      <Badge variant="secondary" className="mt-1 text-[11px]">
                        {staffRoleLabel(s.role, locale)}
                      </Badge>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function PlayerCard({ player: p, locale }: { player: PlayerDoc; locale: Locale }) {
  const accent = POSITION_ACCENT[p.position] ?? POSITION_ACCENT.MF;
  const photoUrl = mediaUrl(p.photo);
  return (
    <Card className="group relative h-full gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-yellow-400/50 hover:shadow-xl hover:shadow-green-900/10">
      <div className="relative aspect-[4/5] overflow-hidden bg-white">
        {/* position pill */}
        <span
          className={`absolute left-3 top-3 z-10 rounded-full bg-gradient-to-br ${accent} px-3 py-1.5 text-sm font-black tracking-widest text-green-950 shadow-md md:text-base`}
        >
          {p.position}
        </span>

        {/* jersey badge */}
        {p.jerseyNumber !== undefined && (
          <span className="absolute right-3 top-3 z-10 rounded-lg bg-yellow-400 px-3 py-1.5 text-lg font-black text-green-950 shadow-lg shadow-yellow-400/20 ring-1 ring-yellow-300 md:text-xl">
            #{p.jerseyNumber}
          </span>
        )}

        {/* Large portrait with player details kept below the photo. */}
        <div className="absolute inset-0">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={p.name}
              fill
              unoptimized
              sizes="(min-width: 1152px) 265px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl font-black text-green-900/40">
              {p.name.slice(0, 1)}
            </div>
          )}
        </div>
      </div>

      {/* player details on a plain white background */}
      <div className="relative bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-green-700 md:text-sm">
          {positionLabel(p.position, locale)}
        </p>
        <h3 className="mt-0.5 line-clamp-1 text-xl font-black text-green-950 md:text-2xl">
          {p.name}
        </h3>
        {p.nationality && (
          <p className="mt-0.5 text-sm font-medium text-slate-600 md:text-base">
            {p.nationality}
          </p>
        )}
      </div>
    </Card>
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
  if (filename) return `/uploads/media/${encodeURIComponent(filename)}`;

  return media.url ?? undefined;
}

type StaffDoc = {
  id: string | number;
  name: string;
  role: string;
  photoUrl?: string;
};
