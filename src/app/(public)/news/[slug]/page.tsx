import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ArrowLeft } from "lucide-react";
import { payload } from "@/lib/payload";
import { formatDateTime } from "@/lib/format";
import { isValidSlug, resolveCover, type NewsDoc } from "../_helpers";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  return { title: `${slug} — ข่าวสาร Pattani FC` };
}

export default async function NewsDetailPage({ params }: { params: Params }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  // กัน path injection — slug ต้อง match pattern ก่อนถึงจะ query
  if (!isValidSlug(slug)) notFound();

  const cms = await payload();
  const { docs } = await cms.find({
    collection: "news",
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: "published" } },
      ],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });

  const news = (docs[0] as unknown as NewsDoc) || null;
  if (!news) notFound();

  const cover = resolveCover(news);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800 hover:underline"
      >
        <ArrowLeft className="size-4" />
        กลับไปหน้าข่าว
      </Link>

      <header className="mt-5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="size-3.5" />
          {news.publishedAt ? formatDateTime(news.publishedAt) : "ยังไม่ระบุวันที่"}
        </div>
        <h1 className="mt-2 text-3xl font-black leading-tight text-green-900 md:text-4xl">
          {news.title}
        </h1>
        {news.summary && (
          <p className="mt-4 whitespace-pre-line text-base text-slate-700">
            {news.summary}
          </p>
        )}
      </header>

      {cover && (
        <div className="relative mt-6 aspect-video overflow-hidden rounded-2xl bg-green-100 shadow">
          <Image
            src={cover}
            alt={news.title}
            fill
            unoptimized
            sizes="(min-width: 1024px) 720px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      {news.body ? (
        <div className="prose prose-green mt-6 max-w-none">
          <NewsBody body={news.body} />
        </div>
      ) : null}
    </article>
  );
}

/**
 * Render Payload richText body แบบ minimal & ปลอดภัย
 * - ไม่ใช้ dangerouslySetInnerHTML
 * - รองรับ Lexical structure (root.children[].children[].text)
 * - ถ้า structure อื่น แสดงเป็น JSON.stringify ก่อน (debug-friendly)
 */
function NewsBody({ body }: { body: unknown }) {
  type Node = { type?: string; text?: string; children?: Node[]; tag?: string };
  const root = (body as { root?: Node })?.root;
  if (!root?.children) return null;

  return (
    <div className="space-y-4 text-base leading-relaxed text-slate-800">
      {root.children.map((node, i) => renderNode(node, i))}
    </div>
  );

  function renderNode(node: Node, key: number): React.ReactNode {
    if (!node) return null;
    if (node.type === "paragraph") {
      return (
        <p key={key}>
          {(node.children ?? []).map((c, ci) => (
            <span key={ci}>{c.text ?? ""}</span>
          ))}
        </p>
      );
    }
    if (node.type === "heading") {
      const Tag = (node.tag as "h1" | "h2" | "h3") ?? "h2";
      return (
        <Tag key={key} className="mt-6 font-bold text-green-900">
          {(node.children ?? []).map((c) => c.text ?? "").join("")}
        </Tag>
      );
    }
    return null;
  }
}
