import { Card, CardContent } from "@/components/ui/card";
import PageHero from "../_components/PageHero";
import { Crown, Users2, Scale, Cpu, UserCog } from "lucide-react";

export const metadata = { title: "ผู้บริหาร — Pattani FC" };

// ข้อมูลคณะผู้บริหารและที่ปรึกษาจาก "โครงการ pattani FC 2026-2030.pdf"
// แสดงผลด้วย JSX (auto-escape) ไม่มี user input → ปลอดภัย XSS โดยปริยาย

type Person = {
  name: string;
  position?: string;
};

type Group = {
  key: string;
  label: string;
  icon: React.ReactNode;
  people: Person[];
  columns?: 1 | 2 | 3;
};

const GROUPS: Group[] = [
  {
    key: "honorary",
    label: "ที่ปรึกษากิตติมศักดิ์",
    icon: <Crown className="size-5" />,
    columns: 2,
    people: [
      { name: "พ.ต.อ.ทวี สอดส่อง" },
      { name: "Mr. Robert Whitfield" },
    ],
  },
  {
    key: "advisors",
    label: "ที่ปรึกษาสโมสร",
    icon: <Users2 className="size-5" />,
    columns: 2,
    people: [
      { name: "นายเศรษฐ์ อัลยุฟรี" },
      { name: "พล.ต.ต.นรินทร์ บูสะมัญ" },
      { name: "พล.ต.ต.แวสาแม สาแล" },
      { name: "ซอลาฮุดดีน หะยียูโซะ" },
    ],
  },
  {
    key: "legal",
    label: "ที่ปรึกษาฝ่ายกฎหมาย",
    icon: <Scale className="size-5" />,
    columns: 1,
    people: [{ name: "นายอับดุลกอฮาร์ อาแวปูเตะ" }],
  },
  {
    key: "technical",
    label: "ที่ปรึกษาฝ่ายเทคนิค",
    icon: <Cpu className="size-5" />,
    columns: 1,
    people: [{ name: "ดร.มูฮัมหมัดอัสมี อาบูบากา" }],
  },
  {
    key: "executive",
    label: "คณะผู้บริหาร",
    icon: <UserCog className="size-5" />,
    columns: 3,
    people: [
      { name: "ผู้ช่วยศาสตราจารย์ ดร.วรวิทย์ บารู", position: "ประธานสโมสร" },
      { name: "รองศาสตราจารย์ ดร.สุกรี หะยีสาแม", position: "รองประธานสโมสร" },
      { name: "นายซัยนูรดีน นิมา", position: "ประธานกรรมการบริหาร (CEO)" },
      { name: "นายอิลเลียส เจ๊ะเลาะ", position: "ผู้อำนวยสำนักงานกีฬาและผู้จัดการทีม" },
      {
        name: "พญ.นินี สุไลมาน",
        position: "รองประธานสโมสรและหัวหน้าฝ่ายวิทยาศาสตร์การกีฬาฯ",
      },
      {
        name: "ดร.นพ.มูฮัมหมัดฟาห์มี ตาเละ",
        position: "ผู้อำนวยการฝ่ายธุรกิจและภาพลักษณ์",
      },
      {
        name: "นายเจะอับดุลลาเตะ ซีเดะ",
        position: "ผู้อำนวยการฝ่ายบริหารสนามและการจัดการ",
      },
      {
        name: "นายมูฮัมหมัดดือราโอ๊ะ",
        position: "ผู้อำนวยการฝ่ายบริหารงานทั่วไป",
      },
      { name: "นายหาญณรงค์ ชุณหะคุณากร", position: "หัวหน้าผู้ฝึกสอน" },
    ],
  },
];

function gridColsFor(columns: 1 | 2 | 3 | undefined): string {
  switch (columns) {
    case 1:
      return "sm:grid-cols-1 md:grid-cols-1";
    case 2:
      return "sm:grid-cols-2 md:grid-cols-2";
    case 3:
    default:
      return "sm:grid-cols-2 md:grid-cols-3";
  }
}

export default function ManagementPage() {
  return (
    <>
      <PageHero
        title="คณะกรรมการผู้บริหารสโมสร"
        subtitle="คณะกรรมการบริหารและที่ปรึกษาสโมสรฟุตบอลปัตตานี เอฟซี"
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        {GROUPS.map((g) => (
          <section key={g.key}>
            <header className="mb-4 flex items-end justify-between gap-3 border-b-2 border-yellow-400/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-green-900 p-2 text-yellow-300">
                  {g.icon}
                </span>
                <h2 className="text-xl font-black text-green-900 md:text-2xl">
                  {g.label}
                </h2>
              </div>
              <span className="rounded-full bg-green-800 px-3 py-1 text-xs font-bold text-yellow-300">
                {g.people.length} คน
              </span>
            </header>

            <ul className={`grid gap-4 ${gridColsFor(g.columns)}`}>
              {g.people.map((p) => (
                <li key={p.name}>
                  <PersonCard person={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function PersonCard({ person }: { person: Person }) {
  // ใช้ initial ตัวแรกของชื่อเป็น avatar fallback — ไม่มีรูปจาก PDF
  // (ภายหลังถ้ามีรูป สามารถเพิ่ม person.photoUrl แล้ว render <Image> ได้)
  const initial = person.name.replace(/^[^ก-๙a-zA-Z]+/, "").charAt(0) || "?";
  return (
    <Card className="h-full overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-800 to-green-950 text-xl font-black text-yellow-300"
        >
          {initial}
        </div>
        <CardContent className="flex-1 p-0">
          <p className="text-base font-bold leading-snug text-green-900 md:text-lg">
            {person.name}
          </p>
          {person.position && (
            <p className="mt-0.5 text-sm text-slate-600">{person.position}</p>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
