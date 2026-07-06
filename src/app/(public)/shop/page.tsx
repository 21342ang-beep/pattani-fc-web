import Image from "next/image";
import { ShoppingBag, Tag } from "lucide-react";
import { payload } from "@/lib/payload";
import { formatBaht } from "@/lib/format";
import PageHero from "../_components/PageHero";
import AddToCartButton from "./_components/AddToCartButton";
import CartLink from "./_components/CartLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "ร้านค้า — Pattani FC" };

type MediaDoc = {
  id: string | number;
  url?: string;
  filename?: string;
  alt?: string;
  width?: number;
  height?: number;
};

type ProductSize = { label: string; stock?: number };

type ProductDoc = {
  id: string | number;
  name: string;
  slug?: string;
  image?: MediaDoc | string | null;
  price: number;
  salePrice?: number | null;
  sizes?: ProductSize[];
  category?: string;
  description?: string;
  active?: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  jersey: "เสื้อแข่ง",
  apparel: "เสื้อผ้า",
  merch: "ของที่ระลึก",
  accessories: "อุปกรณ์",
};

function mediaUrl(m: ProductDoc["image"]): string | null {
  if (!m) return null;
  if (typeof m === "string") return null;
  if (m.url) return m.url;
  if (m.filename) return `/uploads/media/${m.filename}`;
  return null;
}

function mediaAlt(m: ProductDoc["image"], fallback: string): string {
  if (m && typeof m !== "string" && m.alt) return m.alt;
  return fallback;
}

export default async function ShopPage() {
  const cms = await payload();
  const { docs } = await cms.find({
    collection: "products",
    where: { active: { equals: true } },
    sort: "-createdAt",
    limit: 100,
    depth: 1,
    overrideAccess: true,
  });

  const products = docs as unknown as ProductDoc[];

  return (
    <>
      <PageHero
        title="ร้านค้า"
        subtitle="สินค้าทางการของสโมสรปัตตานี เอฟซี · เสื้อแข่ง ของที่ระลึก"
      />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <ShoppingBag className="size-4 text-green-800" />
            ทั้งหมด{" "}
            <span className="font-bold text-green-900">{products.length}</span>{" "}
            รายการ
          </p>
          <CartLink />
        </div>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-lg text-slate-500">
              ยังไม่มีสินค้าวางจำหน่ายในขณะนี้
            </p>
            <p className="mt-1 text-sm text-slate-400">
              กลับมาเยี่ยมชมใหม่อีกครั้งเร็วๆ นี้
            </p>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={String(p.id)}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ProductCard({ product }: { product: ProductDoc }) {
  const img = mediaUrl(product.image);
  const alt = mediaAlt(product.image, product.name);
  const hasSale =
    product.salePrice != null &&
    product.salePrice > 0 &&
    product.salePrice < product.price;
  const sizes = (product.sizes ?? []).filter((s) => s.label?.trim());

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-green-300 hover:shadow-xl">
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {img ? (
          <Image
            src={img}
            alt={alt}
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ShoppingBag className="size-12" />
          </div>
        )}
        {hasSale && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md">
            <Tag className="size-3" />
            ลดราคา
          </span>
        )}
        {product.category && (
          <span className="absolute right-3 top-3 rounded-full bg-green-900/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-300 backdrop-blur-sm">
            {CATEGORY_LABEL[product.category] ?? product.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-bold text-green-900">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-2">
          {hasSale ? (
            <>
              <span className="text-xl font-black text-red-600">
                {formatBaht(product.salePrice! * 100)}
              </span>
              <span className="text-sm text-slate-400 line-through">
                {formatBaht(product.price * 100)}
              </span>
            </>
          ) : (
            <span className="text-xl font-black text-green-900">
              {formatBaht(product.price * 100)}
            </span>
          )}
        </div>

        {sizes.length > 0 && (
          <div className="mt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              ไซส์
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {sizes.map((s, i) => {
                const out = s.stock != null && s.stock <= 0;
                return (
                  <span
                    key={`${s.label}-${i}`}
                    className={`inline-flex min-w-[2rem] items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                      out
                        ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                        : "border-green-200 bg-green-50 text-green-900"
                    }`}
                    title={
                      s.stock != null
                        ? out
                          ? "หมด"
                          : `คงเหลือ ${s.stock}`
                        : undefined
                    }
                  >
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {product.description && (
          <p className="line-clamp-2 pt-1 text-xs text-slate-500">
            {product.description}
          </p>
        )}

        <div className="mt-auto">
          <AddToCartButton
            productId={String(product.id)}
            name={product.name}
            imageUrl={img}
            unitPriceBaht={hasSale ? product.salePrice! : product.price}
            sizes={sizes.map((s) => ({
              label: s.label,
              outOfStock: s.stock != null && s.stock <= 0,
            }))}
          />
        </div>
      </div>
    </article>
  );
}
