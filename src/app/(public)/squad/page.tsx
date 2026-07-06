import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { payload } from "@/lib/payload";
import PageHero from "../_components/PageHero";

const POSITION_ACCENT: Record<string, string> = {
  GK: "from-amber-400 via-yellow-400 to-yellow-500",
  DF: "from-sky-400 via-blue-500 to-blue-600",
  MF: "from-emerald-400 via-green-500 to-green-600",
  FW: "from-rose-400 via-red-500 to-red-600",
};

export const dynamic = "force-dynamic";
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
  const [playersRes, staffRes] = await Promise.all([
    cms.find({
      collection: "players",
      where: { active: { equals: true } },
      sort: "jerseyNumber",
      limit: 100,
      overrideAccess: true,
    }),
    cms.find({
      collection: "staff",
      limit: 50,
      overrideAccess: true,
    }),
  ]);

  const players = playersRes.docs as unknown as PlayerDoc[];
  const staff = staffRes.docs as unknown as StaffDoc[];

  const grouped: Record<string, PlayerDoc[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of players) {
    if (grouped[p.position]) grouped[p.position].push(p);
  }

  return (
    <>
      <PageHero
        title="ผู้เล่นและสตาฟ"
        subtitle="นักเตะชุดใหญ่และทีมงานสตาฟโค้ชของปัตตานี เอฟซี"
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
                      {POSITION_LABEL[pos]}
                    </h2>
                  </div>
                  <span className="rounded-full bg-green-900 px-3 py-1 text-xs font-bold text-yellow-300">
                    {list.length} คน
                  </span>
                </div>
                <ul className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {list.map((p) => (
                    <li key={String(p.id)}>
                      <PlayerCard player={p} />
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
              ยังไม่มีข้อมูลผู้เล่นในระบบ
            </CardContent>
          </Card>
        )}

        {staff.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold text-green-900">ทีมงานสตาฟ</h2>
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
                        {STAFF_ROLE_LABEL[s.role] ?? s.role}
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

function PlayerCard({ player: p }: { player: PlayerDoc }) {
  const accent = POSITION_ACCENT[p.position] ?? POSITION_ACCENT.MF;
  return (
    <Card className="group relative h-full overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-yellow-400/50 hover:shadow-xl hover:shadow-green-900/10">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-green-800 via-green-900 to-green-950">
        {/* radial glow */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(250,204,21,0.22),transparent_60%)]"
        />
        {/* subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:28px_28px]"
        />

        {/* giant decorative jersey number */}
        {p.jerseyNumber !== undefined && (
          <span
            aria-hidden
            className="absolute -bottom-4 -right-3 select-none text-[11rem] font-black leading-none text-white/[0.06]"
          >
            {p.jerseyNumber}
          </span>
        )}

        {/* position pill */}
        <span
          className={`absolute left-3 top-3 rounded-full bg-gradient-to-br ${accent} px-2.5 py-1 text-[10px] font-black tracking-widest text-green-950 shadow-md`}
        >
          {p.position}
        </span>

        {/* jersey badge */}
        {p.jerseyNumber !== undefined && (
          <span className="absolute right-3 top-3 rounded-lg bg-yellow-400 px-2.5 py-1 text-base font-black text-green-950 shadow-lg shadow-yellow-400/20 ring-1 ring-yellow-300">
            #{p.jerseyNumber}
          </span>
        )}

        {/* photo — circular avatar so small source images stay crisp */}
        <div className="absolute left-1/2 top-1/2 flex size-[58%] -translate-x-1/2 -translate-y-[58%] items-center justify-center">
          <div
            aria-hidden
            className={`absolute inset-0 rounded-full bg-gradient-to-br ${accent} opacity-30 blur-2xl transition group-hover:opacity-60`}
          />
          <div className="relative aspect-square h-full overflow-hidden rounded-full border-4 border-yellow-300/90 bg-green-950 shadow-2xl shadow-black/40 ring-1 ring-white/10">
            {p.photoUrl ? (
              <Image
                src={p.photoUrl}
                alt={p.name}
                fill
                unoptimized
                sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 40vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl font-black text-white/40">
                {p.name.slice(0, 1)}
              </div>
            )}
          </div>
        </div>

        {/* bottom overlay with name */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-green-950 via-green-950/85 to-transparent px-4 pb-4 pt-14">
          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-300/85">
            {POSITION_LABEL[p.position]}
          </p>
          <h3 className="mt-0.5 line-clamp-1 text-base font-black text-white md:text-lg">
            {p.name}
          </h3>
          {p.nationality && (
            <p className="mt-0.5 text-[11px] font-medium text-green-100/70">
              {p.nationality}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

type PlayerDoc = {
  id: string | number;
  name: string;
  jerseyNumber?: number;
  position: "GK" | "DF" | "MF" | "FW";
  nationality?: string;
  photoUrl?: string;
};

type StaffDoc = {
  id: string | number;
  name: string;
  role: string;
  photoUrl?: string;
};
