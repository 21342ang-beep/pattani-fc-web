import Image from "next/image";
import {
  Eye,
  Building2,
  Heart,
  Swords,
  Music2,
  Trophy,
  History,
  MapPin,
  Stars,
} from "lucide-react";

export const metadata = { title: "สโมสร — Pattani FC" };

// ข้อมูลในหน้านี้มาจาก "โครงการ pattani FC 2026-2030.pdf" (เอกสารทางการของสโมสร)
// หัวข้อ 1-8 และ 10 — แสดงผลด้วย JSX (auto-escape) ไม่ใช้ dangerouslySetInnerHTML

const HISTORY_PARAGRAPHS = [
  '"ปัตตานี เอฟซี เป็นมากกว่าทีมฟุตบอล" คือแนวคิดสำคัญที่เป็นจุดเริ่มต้นของการก่อตั้งสโมสรฟุตบอลปัตตานี เอฟซี ในปี พ.ศ. 2552 โดยมีเป้าหมายเพื่อเป็นเครื่องมือสร้างความสุข เป็นพื้นที่แห่งความภาคภูมิใจร่วมกันของแฟนบอลทุกศาสนา โดยไม่มีการแบ่งแยก ท่ามกลางสถานการณ์ความไม่สงบในจังหวัดชายแดนภาคใต้ที่อยู่ในช่วงรุนแรงที่สุด สโมสรจึงกลายเป็นสัญลักษณ์แห่งความหวัง ความสามัคคี และพลังใจของผู้คนในพื้นที่',
  "จังหวัดปัตตานีเคยได้รับคัดเลือกให้เข้าร่วมการแข่งขันฟุตบอลโปรลีกครั้งแรกในปี พ.ศ. 2542 แต่หลังสิ้นสุดการแข่งขัน ทีมจังหวัดปัตตานีจบด้วยอันดับสุดท้าย และได้ถอนตัวออกจากการแข่งขันในปีถัดมา ส่งผลให้ทีมฟุตบอลจังหวัดปัตตานี ซึ่งเคยเป็นหนึ่งในมหาอำนาจลูกหนังภาคใต้ และเคยคว้าแชมป์ฟุตบอลโล่พระราชทานชิงแชมป์ภาคใต้ถึง 3 ครั้ง ต้องห่างหายไปจากวงการฟุตบอลลีกไทยเป็นระยะเวลานาน",
  "ต่อมาในปี พ.ศ. 2552 เมื่อมีการแข่งขันฟุตบอลอาชีพลีกภูมิภาค จังหวัดปัตตานีจึงได้กลับเข้าสู่วงการฟุตบอลลีกของประเทศไทยอีกครั้ง โดยนายเศรษฐ์ อัลยุฟรี นายกองค์การบริหารส่วนจังหวัดปัตตานี ซึ่งดำรงตำแหน่งนายกสมาคมกีฬาแห่งจังหวัดปัตตานีในขณะนั้น ได้ริเริ่มจัดตั้งทีมขึ้น และมอบหมายให้รองศาสตราจารย์ ดร.สุกรี หะยีสาแม เข้ามาดูแลทีม ร่วมกับ พญ.นินี สุไลมาน นายอดุลย์ หวันสกุล นายอับดุลลาเต๊ะ สิเดะ และแต่งตั้งนายนิแม นิเดร์ฮะ เป็นหัวหน้าผู้ฝึกสอน ในช่วงเริ่มต้น สโมสรได้คัดเลือกนักฟุตบอลที่มีภูมิลำเนาในจังหวัดปัตตานี ร่วมกับนักฟุตบอลต่างชาติจำนวน 2 คน ได้แก่ Chaibou Adamou และ Phillipe Ram ซึ่งถือเป็นนักฟุตบอลต่างชาติกลุ่มแรกที่เข้ามาค้าแข้งในจังหวัดปัตตานี",
  'ต่อมาในปี พ.ศ. 2558 ตามนโยบายของสมาคมฟุตบอลแห่งประเทศไทย ที่กำหนดให้สโมสรฟุตบอลต้องจดทะเบียนเป็นนิติบุคคล สโมสรฟุตบอลปัตตานี เอฟซี จึงได้จดทะเบียนเป็นห้างหุ้นส่วนจำกัด โดยยังคงยึดมั่นในปรัชญาสำคัญคือ "การเป็นองค์กรที่ไม่แสวงหากำไรเชิงธุรกิจ เพื่อสร้างสุขให้ชาวชายแดนใต้"',
  "ในฤดูกาล 2019 สโมสรได้เข้าร่วมการแข่งขันรอบแชมเปี้ยนลีกโซนล่าง และสามารถคว้าแชมป์ Thai League 4 โซนล่าง ประจำปี 2019 ก่อนเข้าสู่รอบชิงชนะเลิศระดับประเทศ ความสำเร็จดังกล่าวทำให้สโมสรได้เลื่อนชั้นขึ้นสู่ Thai League 3 ตั้งแต่ฤดูกาล 2020 เป็นต้นมา",
  "ในฤดูกาล 2024/2025 สโมสรได้ปรับโครงสร้างการบริหารจัดการทีม โดย ผู้ช่วยศาสตราจารย์ ดร.วรวิทย์ บารู สมาชิกสภาผู้แทนราษฎรจังหวัดปัตตานี รับหน้าที่เป็นประธานสโมสร เพื่อขับเคลื่อนให้ปัตตานี เอฟซี เป็นเครื่องมือสร้างความสุข ความสามัคคี และความเป็นหนึ่งเดียวของพี่น้องประชาชนในจังหวัดปัตตานีและพื้นที่ใกล้เคียง",
];

const MILESTONE_PARAGRAPHS = [
  "ภายใต้การนำของ ผู้ช่วยศาสตราจารย์ ดร.วรวิทย์ บารู ประธานสโมสร ปัตตานี เอฟซี สามารถยกระดับจากการแข่งขันไทยลีก 3 ก้าวขึ้นสู่ไทยลีก 2 ได้อย่างภาคภูมิใจ นับเป็นความสำเร็จครั้งสำคัญของทีมบริหาร ทีมงานสตาฟฟ์โค้ช นักกีฬา ตลอดจนพลังสนับสนุนจากพี่น้องประชาชนชาวปัตตานี และแฟนบอลใน 5 จังหวัดชายแดนภาคใต้",
  "จากความสำเร็จในการก้าวสู่ไทยลีก 2 คณะผู้บริหารสโมสรได้ตั้งเป้าหมายที่ท้าทายยิ่งกว่าเดิม คือ การนำปัตตานี เอฟซี ก้าวสู่เวทีสูงสุดของฟุตบอลอาชีพประเทศไทย (ไทยลีก 1) ภายในกรอบเป้าหมายฤดูกาล 2027/28 ด้วยความร่วมมือจากทุกภาคส่วน ทำให้สโมสรสามารถเร่งจังหวะความสำเร็จได้เร็วกว่าที่คาดหมาย และสามารถคว้าตั๋วเลื่อนชั้นสู่ Thai League 1 (T1) 2026-2027 ได้ภายในระยะเวลาเพียงฤดูกาลเดียว",
  "ในเชิงสถิติ ปัตตานี เอฟซี ยังแสดงให้เห็นถึงพลังของฐานแฟนบอลที่แข็งแกร่งอย่างโดดเด่น โดยในฤดูกาล 2025/26 สโมสรมีจำนวนผู้ชมเกมเหย้ารวมมากกว่า 100,000 คน และมีค่าเฉลี่ยผู้ชมสูงสุดในไทยลีก 2 อยู่ที่ประมาณ 6,765 คนต่อนัด ขณะที่บางเกมสำคัญสามารถดึงแฟนบอลเข้าสนามได้เต็มความจุถึง 12,000 คน",
  "เป้าหมายต่อไปของสโมสรปัตตานี เอฟซี 2026/27 คือ การอยู่อันดับที่ 7–10 ของตารางการแข่งขัน Thai League 1 (T1) เพื่อพิสูจน์ให้เห็นว่าสโมสรจากจังหวัดชายแดนภาคใต้สามารถแข่งขันในระดับสูงสุดของประเทศได้ พร้อมวางวิสัยทัศน์ระยะ 3 ปีจากนี้ ในการยกระดับสู่เวทีฟุตบอลระดับเอเชีย AFC competitions",
];

const ACHIEVEMENTS: { year: string; result: string }[] = [
  { year: "2568", result: "ไทยลีก 2 — สู่ไทยลีก 1" },
  { year: "2567", result: "ไทยลีก 3 — สู่ไทยลีก 2" },
  { year: "2566", result: "ไทยลีก 3 — อันดับ 3" },
  { year: "2565", result: "ไทยลีก 3 — อันดับ 4" },
  { year: "2564", result: "ไทยลีก 3 — อันดับ 10" },
  { year: "2563", result: "ไทยลีก 3 — อันดับ 5" },
  { year: "2562", result: "รองชนะเลิศอันดับ 1 ไทยลีก 4 ระดับประเทศ เลื่อนชั้นขึ้น T3" },
  { year: "2561", result: "ไทยลีก 4 — อันดับ 2 (ผ่านเข้ารอบเพลย์ออฟ)" },
  { year: "2560", result: "ไทยลีก 4 (T4) — อันดับ 3" },
  { year: "2559", result: "ดิวิชั่น 2 — อันดับ 6" },
  { year: "2558", result: "ดิวิชั่น 2 — อันดับ 2 (ผ่านเข้ารอบเพลย์ออฟ)" },
  { year: "2557", result: "ดิวิชั่น 2 — อันดับ 5" },
  { year: "2556", result: "ดิวิชั่น 2 — อันดับ 8" },
  { year: "2555", result: "ดิวิชั่น 2 — อันดับ 2 (ผ่านเข้ารอบแชมเปี้ยนลีก)" },
  { year: "2554", result: "ดิวิชั่น 2 — อันดับ 3" },
  { year: "2553", result: "ดิวิชั่น 2 — อันดับ 7" },
  { year: "2552", result: "ดิวิชั่น 2 — อันดับ 5" },
];

const NICKNAMES = ["ปืนใหญ่ลังกาสุกะ", "ปืนใหญ่พญาตานี", "The Queen Cannons"];

export default function ClubPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-950 text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(34,197,94,0.22),transparent_55%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:gap-12 md:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-400/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-yellow-200 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-yellow-400" />
              BEYOND A FOOTBALL TEAM
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">
              <span className="block">สโมสร</span>
              <span className="block bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                ปัตตานี เอฟซี
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg italic text-green-100/85 md:text-xl">
              &ldquo;สร้างความสุข เสริมศักดิ์ศรี คนแดนใต้&rdquo;
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Pill>EST. 2552 / 2009</Pill>
              <Pill>LANGKASUKA</Pill>
              <Pill>เหลือง · เขียว</Pill>
            </div>
          </div>

          <div className="relative justify-self-center md:justify-self-end">
            <div
              aria-hidden
              className="absolute -inset-12 rounded-full bg-yellow-400/25 blur-3xl"
            />
            <Image
              src="/logo-pattani-fc.png"
              alt="โลโก้สโมสรปัตตานี เอฟซี"
              width={360}
              height={360}
              priority
              className="relative drop-shadow-[0_20px_60px_rgba(250,204,21,0.35)]"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 md:py-16">
        {/* 1. วิสัยทัศน์ */}
        <FeatureCard
          icon={<Eye className="size-6" />}
          number="01"
          title="วิสัยทัศน์"
        >
          <p className="text-xl font-bold leading-relaxed text-green-900 md:text-2xl">
            สร้างสุขให้ชาวชายแดนใต้
            <br className="hidden sm:block" />
            นำปัตตานี เอฟซี สู่ไทยลีก 1 (T1)
          </p>
        </FeatureCard>

        {/* 2. ลักษณะองค์กร */}
        <FeatureCard
          icon={<Building2 className="size-6" />}
          number="02"
          title="ลักษณะองค์กร"
        >
          <p className="text-base leading-relaxed text-slate-700 md:text-lg">
            สโมสรฟุตบอลปัตตานี เอฟซี ปัจจุบันมีสถานะเป็นห้างหุ้นส่วนจำกัด
            บริหารจัดการในรูปแบบองค์กรที่ไม่มุ่งแสวงหากำไร
            ไม่มีค่าตอบแทนสำหรับคณะผู้บริหาร และไม่มีการจัดสรรผลกำไรให้แก่ผู้ถือหุ้น
            ทุกภาคส่วนร่วมกันทำงานด้วยจิตอาสา
            เพราะกำไรที่แท้จริงของสโมสร คือ การเป็นเครื่องมือในการสร้างความสุข
            ส่งเสริมภาพลักษณ์ที่ดีของพื้นที่
            และร่วมขับเคลื่อนสันติภาพให้แก่ชาวปัตตานีและจังหวัดชายแดนภาคใต้
          </p>
          <p className="mt-3 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 text-sm font-medium text-green-900 md:text-base">
            สโมสรเป็นสิทธิ์ของสมาคมกีฬาแห่งจังหวัดปัตตานี
            ซึ่งไม่สามารถโอนหรือจำหน่ายสิทธิ์ได้
          </p>
        </FeatureCard>

        {/* 3 + 4: ปรัชญา + รูปแบบ */}
        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard
            icon={<Heart className="size-6" />}
            number="03"
            title="ปรัชญาทีม"
            compact
          >
            <p className="text-base leading-relaxed text-slate-700 md:text-lg">
              เป็นองค์กรที่ไม่แสวงหากำไรเชิงธุรกิจ
              แต่ยืนหยัดต่อสู้เพื่อสร้างความสุขให้แก่ชาวจังหวัดชายแดนภาคใต้
            </p>
          </FeatureCard>
          <FeatureCard
            icon={<Swords className="size-6" />}
            number="04"
            title="รูปแบบการเล่น"
            compact
          >
            <p className="text-base leading-relaxed text-slate-700 md:text-lg">
              มุ่งเน้นเกมรุก เดินหน้าบุกอย่างต่อเนื่อง ไม่ถอย
              และสู้เต็มที่ในทุกการแข่งขัน
            </p>
          </FeatureCard>
        </div>

        {/* 5 + 6: เพลง + ฉายา */}
        <FeatureCard
          icon={<Music2 className="size-6" />}
          number="05 — 06"
          title="เพลงประจำทีม & ฉายา"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-yellow-700">
                เพลงประจำทีม
              </p>
              <p className="mt-1 text-xl font-black text-green-900 md:text-2xl">
                Go Go Go ปืนใหญ่พญาตานี
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-yellow-700">
                ฉายา
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {NICKNAMES.map((n) => (
                  <li
                    key={n}
                    className="rounded-full bg-green-800 px-3 py-1 text-sm font-semibold text-yellow-300"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </FeatureCard>

        {/* 7. กำเนิดปัตตานี เอฟซี */}
        <FeatureCard
          icon={<History className="size-6" />}
          number="07"
          title="กำเนิดปัตตานี เอฟซี"
        >
          <div className="space-y-4 text-base leading-relaxed text-slate-700 md:text-lg">
            {HISTORY_PARAGRAPHS.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </FeatureCard>

        {/* 8. ก้าวประวัติศาสตร์ + ผลงาน */}
        <FeatureCard
          icon={<Trophy className="size-6" />}
          number="08"
          title="ก้าวประวัติศาสตร์: ไทยลีก 3 → ไทยลีก 1 ใน 1 ปี"
        >
          <div className="space-y-4 text-base leading-relaxed text-slate-700 md:text-lg">
            {MILESTONE_PARAGRAPHS.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="mt-7">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-green-900">
              <Stars className="size-5 text-yellow-500" />
              ผลงานสโมสรปัตตานี เอฟซี
            </h3>
            <div className="overflow-hidden rounded-xl border border-green-100">
              <table className="w-full text-sm md:text-base">
                <thead className="bg-green-900 text-yellow-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold">ปี พ.ศ.</th>
                    <th className="px-4 py-2.5 text-left font-bold">ผลงานสโมสร</th>
                  </tr>
                </thead>
                <tbody>
                  {ACHIEVEMENTS.map((a, i) => (
                    <tr
                      key={a.year}
                      className={i % 2 === 0 ? "bg-white" : "bg-green-50/40"}
                    >
                      <td className="whitespace-nowrap px-4 py-2 font-bold text-green-900">
                        {a.year}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{a.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FeatureCard>

        {/* 10. สนาม */}
        <FeatureCard
          icon={<MapPin className="size-6" />}
          number="10"
          title="สนามเรนโบว์ สเตเดียม (The Rainbow Stadium)"
        >
          <p className="text-base leading-relaxed text-slate-700 md:text-lg">
            The Rainbow Stadium หรือสนามกีฬาสังกัดองค์การบริหารส่วนจังหวัดปัตตานี
            เป็นสนามเหย้าของสโมสรฟุตบอลปัตตานี เอฟซี
            มีขนาดสนามที่เหมาะสมสำหรับการแข่งขันฟุตบอล
            และสามารถรองรับแฟนบอลได้มากกว่า 10,000 คน พร้อมอัฒจันทร์โดยรอบ
          </p>
          <p className="mt-3 text-base leading-relaxed text-slate-700 md:text-lg">
            สนามแห่งนี้ได้รับการปรับปรุงและทาสีใหม่จนกลายเป็นเอกลักษณ์สำคัญของสโมสร
            ด้วยสีสันที่สดใสโดดเด่น พร้อมตั้งชื่อสนามเหย้าว่า &ldquo;เดอะเรนโบว์
            สเตเดียม&rdquo;
            สโมสรยังสามารถบริหารจัดการด้านการจราจรและพื้นที่จอดรถโดยรอบสนามได้อย่างมีประสิทธิภาพ
            ทั้งรถยนต์และรถจักรยานยนต์ แม้ในวันที่มีแฟนบอลเข้าชมการแข่งขันจำนวนหลายพันคน
          </p>
          <p className="mt-3 text-base leading-relaxed text-slate-700 md:text-lg">
            นอกจากนี้ สนามยังตั้งอยู่ใกล้มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี
            และสวนสมเด็จพระศรีนครินทราบรมราชชนนี
            ทำให้แฟนบอลที่เดินทางมาชมการแข่งขันมีทางเลือกในการพักผ่อนและใช้เวลาร่วมกันหลากหลายรูปแบบ
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Fact label="ความจุ" value="10,000+ ที่นั่ง" />
            <Fact label="ที่ตั้ง" value="ใกล้ ม.อ. ปัตตานี" />
            <Fact label="เจ้าของ" value="อบจ. ปัตตานี" />
          </div>
        </FeatureCard>
      </div>
    </>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-yellow-300/40 bg-white/5 px-4 py-2 text-sm font-semibold text-yellow-100 backdrop-blur-sm md:text-base">
      {children}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-yellow-300/60 bg-yellow-50 p-4 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-green-900 md:text-lg">{value}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  number,
  title,
  children,
  compact,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-green-100 bg-white shadow-sm ${
        compact ? "p-6" : "p-6 md:p-8"
      }`}
    >
      <header className="mb-4 flex items-start gap-4 border-b border-green-100 pb-4">
        <div className="rounded-xl bg-green-900 p-2.5 text-yellow-300">{icon}</div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-700">
            {number}
          </p>
          <h2 className="mt-0.5 text-xl font-black text-green-900 md:text-2xl">
            {title}
          </h2>
        </div>
      </header>
      {children}
    </section>
  );
}
