import Link from "next/link";
import {
  Target,
  Sparkles,
  Calendar,
  Trophy,
  HeartHandshake,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  Info,
} from "lucide-react";
import PageHero from "../_components/PageHero";

export const metadata = { title: "ทีมเยาวชน — Pattani FC" };

// ข้อมูลในหน้านี้เป็น "วิสัยทัศน์/แผนงานในอนาคต" ของสโมสร
// ปัจจุบันยังไม่ได้เปิดอคาเดมีจริง — เนื้อหาทั้งหมดอธิบายเป้าหมายและกรอบเวลา
// ตามภาพ YOUTH DEVELOPMENT — สร้างนักเตะจากชายแดนใต้

type AgeGroup = {
  code: string;
  ageLabel: string;
  focus: string;
  highlight?: boolean;
};
const AGE_GROUPS: AgeGroup[] = [
  {
    code: "U12",
    ageLabel: "อายุไม่เกิน 12 ปี",
    focus: "ปลูกฝังเทคนิคพื้นฐานและความสนุกในการเล่น",
  },
  {
    code: "U14",
    ageLabel: "อายุไม่เกิน 14 ปี",
    focus: "พัฒนาความรู้เกม สมรรถภาพร่างกาย และวินัยการฝึกซ้อม",
  },
  {
    code: "U16",
    ageLabel: "อายุไม่เกิน 16 ปี",
    focus: "ยกระดับยุทธวิธี ตำแหน่งการเล่น และจิตวิทยาในสนาม",
    highlight: true,
  },
  {
    code: "U18",
    ageLabel: "อายุไม่เกิน 18 ปี",
    focus: "เตรียมความพร้อมสู่ฟุตบอลกึ่งอาชีพ พร้อมเส้นทางการศึกษา",
  },
  {
    code: "U21",
    ageLabel: "อายุไม่เกิน 21 ปี",
    focus: "ป้อนชุดใหญ่ของสโมสร และเส้นทางสู่ทีมชาติ",
  },
];

type Pillar = { Icon: typeof Target; title: string; body: string };
const PILLARS: Pillar[] = [
  {
    Icon: GraduationCap,
    title: "เรียน-เล่นไปด้วยกัน",
    body: "ร่วมกับสถาบันการศึกษาในพื้นที่ ให้นักเตะเยาวชนพัฒนาทั้งด้านวิชาการและกีฬาอย่างสมดุล",
  },
  {
    Icon: HeartHandshake,
    title: "เปิดกว้างทุกเชื้อชาติ-ศาสนา",
    body: "ยึดปรัชญาของสโมสรในการเป็นพื้นที่แห่งความสามัคคีของชายแดนใต้ — เด็กทุกคนมีโอกาสเท่ากัน",
  },
  {
    Icon: ShieldCheck,
    title: "Child Safeguarding",
    body: "ระบบดูแลความปลอดภัย-สวัสดิภาพเด็กตามมาตรฐาน FA Thailand และ AFC Youth",
  },
];

type RoadmapPhase = {
  period: string;
  title: string;
  detail: string;
  status: "planning" | "future";
};
const ROADMAP: RoadmapPhase[] = [
  {
    period: "2026 — เตรียมการ",
    title: "วางโครงสร้างและจัดหาผู้สนับสนุน",
    detail:
      "ตั้งคณะทำงานอคาเดมี ออกแบบหลักสูตร และระดมพันธมิตรในจังหวัดปัตตานี",
    status: "planning",
  },
  {
    period: "2027 — เปิดตัว U12 และ U14",
    title: "นำร่อง 2 รุ่นแรก",
    detail: "เปิดรับสมัครคัดเลือกจาก 5 จังหวัดชายแดนใต้ จัดฝึกซ้อมที่สนามสโมสร",
    status: "future",
  },
  {
    period: "2028 — ขยาย U16 และ U18",
    title: "ครบ 4 รุ่น พร้อมการแข่งขัน",
    detail: "ส่งทีมเข้าร่วมรายการเยาวชนของสมาคมฯ และจัดทัวร์นาเมนต์เชิญพิเศษ",
    status: "future",
  },
  {
    period: "2029 — เชื่อมต่อชุดใหญ่",
    title: "เปิด U21 และเส้นทางสู่ทีมชุดใหญ่",
    detail: "ดาวรุ่งที่ผ่านเกณฑ์เซ็นสัญญาสำรองกับชุดใหญ่ของสโมสร",
    status: "future",
  },
  {
    period: "2030 — เป้าหมายระยะยาว",
    title: "ผลิตนักเตะทีมชาติอย่างน้อย 3 คน",
    detail: "ผู้เล่นจากอคาเดมีติดทีมชาติชุดต่างๆ และยืนหยัดในไทยลีก 1",
    status: "future",
  },
];

export default function YouthPage() {
  return (
    <>
      <PageHero
        title="YOUTH DEVELOPMENT — ทีมเยาวชน"
        subtitle="สร้างนักเตะจากชายแดนใต้ · วิสัยทัศน์อคาเดมีของปัตตานี เอฟซี"
      />

      {/* แจ้งเตือน: ยังไม่ได้เปิดจริง */}
      <section className="mx-auto max-w-5xl px-4 pt-8">
        <div className="flex items-start gap-3 rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-5 shadow-sm">
          <Info
            className="mt-0.5 size-5 shrink-0 text-yellow-700"
            aria-hidden
          />
          <div>
            <p className="text-sm font-black text-yellow-900 md:text-base">
              โครงการอยู่ระหว่างวางแผน — ยังไม่ได้เปิดรับสมัครจริง
            </p>
            <p className="mt-1 text-sm text-yellow-900/80">
              ปัจจุบันสโมสรยังไม่มีทีมเยาวชนของตัวเอง
              เนื้อหาในหน้านี้เป็นวิสัยทัศน์และแผนงานในอนาคตที่จะเดินหน้าตามกรอบเวลาด้านล่าง
            </p>
          </div>
        </div>
      </section>

      {/* เป้าหมายหลัก */}
      <section className="mx-auto max-w-5xl px-4 pt-10 md:pt-14">
        <div className="overflow-hidden rounded-3xl border-2 border-green-900/10 bg-gradient-to-br from-green-900 via-green-800 to-green-950 p-7 text-yellow-100 shadow-xl md:p-10">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-yellow-300/80">
            <Target className="size-4" /> Mission 2030
          </p>
          <h2 className="mt-2 text-2xl font-black text-yellow-300 md:text-4xl">
            ผลิตนักเตะทีมชาติอย่างน้อย 3 คน ภายในปี 2030
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-green-100/80 md:text-base">
            อคาเดมีของปัตตานี เอฟซี
            มุ่งสร้างนักเตะเยาวชนคุณภาพจากพื้นที่ชายแดนภาคใต้
            ให้มีโอกาสเติบโตในระดับลีกอาชีพ และก้าวขึ้นสู่ทีมชาติไทย
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <MetricCard
              icon={<Trophy className="size-5" />}
              kicker="เป้าหมายปี"
              value="2030"
            />
            <MetricCard
              icon={<Sparkles className="size-5" />}
              kicker="ผู้เล่นทีมชาติ"
              value="≥ 3 คน"
              highlight
            />
            <MetricCard
              icon={<Calendar className="size-5" />}
              kicker="เริ่มนำร่อง"
              value="2027"
            />
          </div>
        </div>
      </section>

      {/* 5 รุ่นอายุ */}
      <section className="mx-auto max-w-7xl px-4 pt-14 md:pt-20">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
            Age Groups
          </p>
          <h2 className="mt-1.5 text-3xl font-black text-green-900 md:text-4xl">
            5 รุ่นอายุที่วางแผนเปิด
          </h2>
          <p className="mt-2 text-base text-slate-600">
            ตั้งแต่ U12 ถึง U21 — เส้นทางการพัฒนาแบบต่อเนื่องสู่ทีมชุดใหญ่
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {AGE_GROUPS.map((g) => (
            <li key={g.code}>
              <AgeCard group={g} />
            </li>
          ))}
        </ul>
      </section>

      {/* เสาหลัก 3 ข้อ */}
      <section className="mx-auto max-w-7xl px-4 pt-14 md:pt-20">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
            Pillars
          </p>
          <h2 className="mt-1.5 text-3xl font-black text-green-900 md:text-4xl">
            เสาหลักของอคาเดมี
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-green-100 text-green-800">
                <p.Icon className="size-6" aria-hidden />
              </div>
              <h3 className="text-lg font-black text-green-900">{p.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto max-w-5xl px-4 pt-14 md:pt-20">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
            Roadmap
          </p>
          <h2 className="mt-1.5 text-3xl font-black text-green-900 md:text-4xl">
            กรอบเวลาดำเนินงาน
          </h2>
          <p className="mt-2 text-base text-slate-600">
            แผนเปิดตัวอคาเดมีระยะ 5 ปี
          </p>
        </div>

        <ol className="relative space-y-5 border-l-2 border-green-200 pl-6">
          {ROADMAP.map((p, idx) => (
            <li key={p.period} className="relative">
              <span
                className={`absolute -left-[34px] top-1 inline-flex size-7 items-center justify-center rounded-full text-xs font-black shadow ${
                  p.status === "planning"
                    ? "bg-yellow-400 text-green-950"
                    : "bg-green-800 text-yellow-300"
                }`}
                aria-hidden
              >
                {idx + 1}
              </span>
              <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                      p.status === "planning"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {p.status === "planning" ? "กำลังวางแผน" : "แผนอนาคต"}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {p.period}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-black text-green-900">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        <div className="rounded-3xl border-2 border-green-100 bg-white p-7 shadow-sm md:p-10">
          <h2 className="text-2xl font-black text-green-900 md:text-3xl">
            สนใจร่วมเป็นส่วนหนึ่งของอคาเดมี?
          </h2>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            หากคุณเป็นผู้ปกครอง สถาบันการศึกษา หรือผู้สนับสนุนที่สนใจ —
            สามารถติดต่อสโมสรไว้ก่อน เพื่อรับข่าวสารเมื่อเปิดรับสมัครจริง
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-5 py-3 text-base font-semibold text-yellow-300 transition hover:bg-green-900"
            >
              ติดต่อสโมสร <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/club"
              className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-white px-5 py-3 text-base font-medium text-green-900 transition hover:bg-green-50"
            >
              ดูข้อมูลสโมสร
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function MetricCard({
  icon,
  kicker,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  kicker: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-yellow-300/60 bg-yellow-300/10"
          : "border-green-100/30 bg-white/5"
      }`}
    >
      <div
        className={`inline-flex size-9 items-center justify-center rounded-xl ${
          highlight
            ? "bg-yellow-300 text-green-950"
            : "bg-green-700/40 text-yellow-200"
        }`}
      >
        {icon}
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-yellow-200/80">
        {kicker}
      </p>
      <p
        className={`mt-0.5 text-2xl font-black ${
          highlight ? "text-yellow-300" : "text-yellow-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AgeCard({ group }: { group: AgeGroup }) {
  const highlighted = group.highlight;
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border-2 p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        highlighted
          ? "border-yellow-400 bg-gradient-to-b from-green-900 to-green-950 text-yellow-100"
          : "border-green-100 bg-white"
      }`}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-widest ${
          highlighted ? "text-yellow-300/70" : "text-yellow-600"
        }`}
      >
        Age Group
      </span>
      <span
        className={`mt-1 text-4xl font-black tracking-tight ${
          highlighted ? "text-yellow-300" : "text-green-900"
        }`}
      >
        {group.code}
      </span>
      <span
        className={`mt-1 text-xs font-medium ${
          highlighted ? "text-yellow-100/80" : "text-slate-500"
        }`}
      >
        {group.ageLabel}
      </span>
      <p
        className={`mt-3 text-sm ${
          highlighted ? "text-yellow-100/90" : "text-slate-600"
        }`}
      >
        {group.focus}
      </p>
    </div>
  );
}
