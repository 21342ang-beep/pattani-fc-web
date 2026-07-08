import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import { payload } from "@/lib/payload";

export const dynamic = "force-dynamic";
export const metadata = { title: "จัดการหน้าเว็บไซต์ — Pattani FC Admin" };

type CardDef = {
  key: string;
  icon: string;
  title: string;
  description: string;
  collection?:
    | "news"
    | "sponsors"
    | "players"
    | "staff"
    | "management"
    | "products";
  cmsPath: string;
  publicPath: string;
  publishedField?: { name: string; value: string };
  group: "content" | "people" | "commerce";
  comingSoon?: boolean;
};

const CARDS: CardDef[] = [
  {
    key: "news",
    icon: "📰",
    title: "ข่าวสาร",
    description: "ข่าวสารและประกาศต่างๆ ของสโมสร แสดงที่หน้า /news",
    collection: "news",
    cmsPath: "/cms/collections/news",
    publicPath: "/news",
    publishedField: { name: "status", value: "published" },
    group: "content",
  },
  {
    key: "sponsors",
    icon: "🤝",
    title: "พาร์ทเนอร์",
    description: "ผู้สนับสนุนและพันธมิตร แสดงที่หน้า /partners และหน้าหลัก",
    collection: "sponsors",
    cmsPath: "/cms/collections/sponsors",
    publicPath: "/partners",
    publishedField: { name: "active", value: "true" },
    group: "content",
  },
  {
    key: "players",
    icon: "⚽",
    title: "ผู้เล่น",
    description: "นักเตะในทีมชุดใหญ่ แสดงที่หน้า /squad",
    collection: "players",
    cmsPath: "/cms/collections/players",
    publicPath: "/squad",
    group: "people",
  },
  {
    key: "staff",
    icon: "🧑‍🏫",
    title: "ทีมงานสตาฟ",
    description: "โค้ช ผู้ช่วยโค้ช และทีมงาน แสดงที่หน้า /squad",
    collection: "staff",
    cmsPath: "/cms/collections/staff",
    publicPath: "/squad",
    group: "people",
  },
  {
    key: "management",
    icon: "👔",
    title: "ผู้บริหาร",
    description: "คณะผู้บริหารของสโมสร แสดงที่หน้า /management",
    collection: "management",
    cmsPath: "/cms/collections/management",
    publicPath: "/management",
    group: "people",
  },
  {
    key: "shop",
    icon: "🛍️",
    title: "จัดการร้านค้า",
    description: "สินค้าทางการของสโมสร เสื้อแข่ง ของที่ระลึก แสดงที่หน้า /shop",
    collection: "products",
    cmsPath: "/cms/collections/products",
    publicPath: "/shop",
    publishedField: { name: "active", value: "true" },
    group: "commerce",
  },
];

async function getCounts() {
  const cms = await payload();

  const results = await Promise.all(
    CARDS.map(async (c) => {
      if (!c.collection) {
        return { key: c.key, total: 0, published: null as number | null };
      }
      const total = await cms.count({
        collection: c.collection,
        overrideAccess: true,
      });

      let published: number | null = null;
      if (c.publishedField) {
        const where =
          c.publishedField.name === "active"
            ? { active: { equals: true } }
            : { [c.publishedField.name]: { equals: c.publishedField.value } };
        const pub = await cms.count({
          collection: c.collection,
          overrideAccess: true,
          where,
        });
        published = pub.totalDocs;
      }

      return { key: c.key, total: total.totalDocs, published };
    })
  );

  const map: Record<string, { total: number; published: number | null }> = {};
  for (const r of results) map[r.key] = { total: r.total, published: r.published };
  return map;
}

export default async function WebsiteManagementPage() {
  await verifyPermission("WEBSITE");
  const counts = await getCounts();

  const contentCards = CARDS.filter((c) => c.group === "content");
  const peopleCards = CARDS.filter((c) => c.group === "people");
  const commerceCards = CARDS.filter((c) => c.group === "commerce");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
          เครื่องมือผู้ดูแล
        </p>
        <h1 className="mt-1.5 text-3xl font-black text-green-900 md:text-4xl">
          จัดการหน้าเว็บไซต์
        </h1>
        <p className="mt-2 max-w-3xl text-base text-slate-600">
          ศูนย์รวมการจัดการเนื้อหาทั้งหมดที่แสดงในหน้าเว็บไซต์สาธารณะ —
          แก้ไขผ่าน Payload CMS ได้ทันที พร้อมดูตัวอย่างหน้าจริงเทียบเคียง
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          label="รายการเนื้อหาทั้งหมด"
          value={CARDS.reduce((s, c) => s + (counts[c.key]?.total ?? 0), 0)}
          tone="green"
        />
        <StatBox
          label="กำลังเผยแพร่"
          value={CARDS.reduce(
            (s, c) => s + (counts[c.key]?.published ?? counts[c.key]?.total ?? 0),
            0
          )}
          tone="yellow"
        />
        <StatBox label="กลุ่มเนื้อหา" value={CARDS.length} tone="slate" />
        <StatBox
          label="หน้า public ที่เชื่อมโยง"
          value={new Set(CARDS.map((c) => c.publicPath)).size}
          tone="slate"
        />
      </div>

      {/* Content */}
      <section>
        <SectionTitle icon="📝" title="เนื้อหาหลัก" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contentCards.map((c) => (
            <ContentCard key={c.key} card={c} counts={counts[c.key]} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon="🧑‍🤝‍🧑" title="บุคลากร" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {peopleCards.map((c) => (
            <ContentCard key={c.key} card={c} counts={counts[c.key]} />
          ))}
        </div>
      </section>

      {commerceCards.length > 0 && (
        <section>
          <SectionTitle icon="🛒" title="ร้านค้า" />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {commerceCards.map((c) => (
              <ContentCard key={c.key} card={c} counts={counts[c.key]} />
            ))}
          </div>
        </section>
      )}

      {/* Tips */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-amber-900">
            <p className="font-semibold">เคล็ดลับการใช้งาน</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>กด <b>&quot;จัดการ&quot;</b> เพื่อเปิด Payload CMS — ที่นั่นจะแก้ไข สร้างใหม่ หรือลบรายการได้</li>
              <li>กด <b>&quot;ดูหน้าจริง&quot;</b> เพื่อเปิดดูผลลัพธ์ที่แสดงในเว็บไซต์สาธารณะ</li>
              <li>การเปลี่ยนแปลงในเนื้อหาจะแสดงผลที่หน้าเว็บไซต์โดยอัตโนมัติ (server-rendered, ไม่ต้อง build)</li>
              <li>ข่าวจะแสดงเฉพาะที่ <b>status = เผยแพร่</b> เท่านั้น พาร์ทเนอร์จะแสดงเฉพาะที่ <b>active = true</b></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-end justify-between border-b-2 border-yellow-400/60 pb-2">
      <h2 className="text-xl font-black text-green-900 md:text-2xl">
        <span className="mr-2">{icon}</span>
        {title}
      </h2>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "yellow" | "slate";
}) {
  const styles = {
    green: "border-green-200 bg-green-50 text-green-900",
    yellow: "border-yellow-300 bg-yellow-50 text-yellow-900",
    slate: "border-slate-200 bg-white text-slate-900",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

function ContentCard({
  card,
  counts,
}: {
  card: CardDef;
  counts?: { total: number; published: number | null };
}) {
  const total = counts?.total ?? 0;
  const published = counts?.published ?? null;
  const hidden = published !== null ? total - published : null;

  return (
    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <span className="text-4xl">{card.icon}</span>
        {card.comingSoon ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-800">
            เร็วๆ นี้
          </span>
        ) : (
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              ทั้งหมด
            </p>
            <p className="text-2xl font-black text-green-900">{total}</p>
          </div>
        )}
      </div>

      <h3 className="mt-3 text-lg font-bold text-green-900">{card.title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-600">
        {card.description}
      </p>

      {!card.comingSoon && published !== null && (
        <div className="mt-3 flex gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
            ● แสดงผล {published}
          </span>
          {hidden !== null && hidden > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              ● ซ่อน {hidden}
            </span>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {card.comingSoon ? (
          <span
            aria-disabled
            className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500"
          >
            🚧 ยังไม่เปิด
          </span>
        ) : (
          <a
            href={card.cmsPath}
            target="_blank"
            rel="noopener"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-yellow-300 transition hover:bg-green-900"
          >
            ✏️ จัดการ
          </a>
        )}
        <Link
          href={card.publicPath}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-50"
        >
          👁️ ดูหน้าจริง
        </Link>
      </div>
    </div>
  );
}
