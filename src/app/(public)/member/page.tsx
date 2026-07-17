import Image from "next/image";
import Link from "next/link";
import { Gift, Sparkles, Calendar, ArrowRight } from "lucide-react";
import { verifyCustomer } from "@/lib/customer-dal";
import { logoutCustomer } from "@/app/actions/customer-auth";
import { payload } from "@/lib/payload";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "สมาชิก — Pattani FC" };

type MediaDoc = { id: string | number; url?: string; filename?: string; alt?: string };

type PromotionDoc = {
  id: string | number;
  title: string;
  type?: string;
  cover?: MediaDoc | string | null;
  summary?: string;
  description?: string;
  prize?: string;
  startAt?: string;
  endAt?: string;
  memberOnly?: boolean;
  active?: boolean;
};

const TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  lucky_draw: { label: "🎁 ลุ้นรางวัล", tone: "bg-yellow-100 text-yellow-900" },
  promo: { label: "✨ โปรโมชั่น", tone: "bg-pink-100 text-pink-900" },
  discount: { label: "💸 ส่วนลด", tone: "bg-emerald-100 text-emerald-900" },
  event: { label: "🎪 กิจกรรม", tone: "bg-blue-100 text-blue-900" },
};

function mediaUrl(m: PromotionDoc["cover"]): string | null {
  if (!m || typeof m === "string") return null;
  if (m.url) return m.url;
  if (m.filename) return `/uploads/media/${m.filename}`;
  return null;
}

const NOTICE_MESSAGES: Record<string, string> = {
  email_from_google:
    "เราใช้อีเมลจากบัญชี Google ที่ยืนยันแล้วเป็นอีเมลบัญชีของคุณ (ต่างจากที่กรอกไว้) เพื่อความปลอดภัย",
  email_from_line:
    "เราใช้อีเมลจากบัญชี LINE ที่ยืนยันแล้วเป็นอีเมลบัญชีของคุณ (ต่างจากที่กรอกไว้) เพื่อความปลอดภัย",
};

export default async function MemberPage(props: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const customer = await verifyCustomer();
  const { notice } = await props.searchParams;
  const noticeMessage = notice ? NOTICE_MESSAGES[notice] : undefined;

  const cms = await payload();
  const { docs } = await cms.find({
    collection: "promotions",
    where: { active: { equals: true } },
    sort: "-startAt",
    limit: 20,
    depth: 1,
    overrideAccess: true,
  });
  const promotions = docs as unknown as PromotionDoc[];

  return (
    <div className="bg-gradient-to-b from-green-50 to-white">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-950 text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.18),transparent_55%)]"
        />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-full bg-yellow-400 text-2xl font-black text-green-950">
              {customer.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-yellow-300">
                สวัสดี
              </p>
              <h1 className="text-2xl font-black md:text-3xl">{customer.name}</h1>
              <p className="text-sm text-green-100/80">{customer.email}</p>
            </div>
          </div>

          <form action={logoutCustomer}>
            <button className="rounded-full border border-yellow-300/30 bg-white/5 px-5 py-2 text-sm font-semibold text-yellow-100 backdrop-blur-sm transition hover:bg-white/10">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </section>

      {noticeMessage && (
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span aria-hidden>ℹ️</span>
            <span>
              {noticeMessage} — อีเมลบัญชีปัจจุบันคือ{" "}
              <strong>{customer.email}</strong>
            </span>
          </p>
        </div>
      )}

      {/* Quick links */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickCard
            href="/shop"
            icon="🛍️"
            title="ช้อปสินค้าทางการ"
            desc="เสื้อแข่ง ของที่ระลึก และอุปกรณ์เชียร์"
          />
          <QuickCard
            href="/matches"
            icon="🎟️"
            title="จองตั๋วเข้าชม"
            desc="ดูตารางแมตช์และจองที่นั่ง"
          />
          <QuickCard
            href="/bookings/search"
            icon="🔍"
            title="ตรวจสอบการจอง"
            desc="ดูประวัติการจองและสถานะ"
          />
        </div>
      </section>

      {/* Activities */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="flex items-end justify-between border-b-2 border-yellow-400/60 pb-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-yellow-600">
              <Sparkles className="size-3.5" />
              เฉพาะสมาชิก
            </p>
            <h2 className="mt-1 text-2xl font-black text-green-900 md:text-3xl">
              กิจกรรมลุ้นรางวัล &amp; โปรโมชั่น
            </h2>
          </div>
          <span className="rounded-full bg-green-800 px-3 py-1 text-xs font-bold text-yellow-300">
            {promotions.length} กิจกรรม
          </span>
        </div>

        {promotions.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Gift className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-lg text-slate-500">
              ยังไม่มีกิจกรรมในขณะนี้
            </p>
            <p className="mt-1 text-sm text-slate-400">
              เราจะแจ้งให้ทราบเมื่อมีกิจกรรมใหม่ — ติดตามได้เร็วๆ นี้
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {promotions.map((p) => (
              <li key={String(p.id)}>
                <PromoCard promo={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function QuickCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-green-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-400 hover:shadow-lg"
    >
      <span className="text-3xl">{icon}</span>
      <div className="flex-1">
        <h3 className="font-bold text-green-900">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-600">{desc}</p>
      </div>
      <ArrowRight className="size-5 shrink-0 text-green-700 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function PromoCard({ promo }: { promo: PromotionDoc }) {
  const img = mediaUrl(promo.cover);
  const typeInfo = promo.type ? TYPE_LABEL[promo.type] : undefined;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-green-300 hover:shadow-xl">
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-green-800 to-green-950">
        {img && (
          <Image
            src={img}
            alt={promo.title}
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {typeInfo && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${typeInfo.tone}`}
          >
            {typeInfo.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="line-clamp-2 text-lg font-bold text-green-900">
          {promo.title}
        </h3>
        {promo.summary && (
          <p className="line-clamp-2 text-sm text-slate-600">{promo.summary}</p>
        )}
        {promo.prize && (
          <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-900">
            🏆 รางวัล: {promo.prize}
          </p>
        )}
        {promo.endAt && (
          <p className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-slate-500">
            <Calendar className="size-3.5" />
            สิ้นสุด {formatDateTime(promo.endAt)}
          </p>
        )}
      </div>
    </article>
  );
}
