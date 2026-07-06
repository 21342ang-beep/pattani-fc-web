"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Plus, ShoppingCart } from "lucide-react";
import { addToCart, type ShopCartItem } from "@/lib/shop-cart";

type Props = {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPriceBaht: number;
  sizes: { label: string; outOfStock: boolean }[];
};

export default function AddToCartButton({
  productId,
  name,
  imageUrl,
  unitPriceBaht,
  sizes,
}: Props) {
  const hasSizes = sizes.length > 0;
  const firstAvailable = sizes.find((s) => !s.outOfStock)?.label ?? sizes[0]?.label ?? "";
  const [size, setSize] = useState<string>(firstAvailable);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (hasSizes && !size) return;
    const item: ShopCartItem = {
      productId,
      name,
      imageUrl,
      unitPriceBaht,
      quantity: 1,
      size: size || undefined,
    };
    startTransition(() => {
      addToCart(item);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1600);
    });
  }

  const selectedOutOfStock =
    hasSizes && size ? sizes.find((s) => s.label === size)?.outOfStock : false;

  return (
    <div className="mt-3 space-y-2">
      {hasSizes && (
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => {
            const active = s.label === size;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => !s.outOfStock && setSize(s.label)}
                disabled={s.outOfStock}
                aria-pressed={active}
                className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold transition ${
                  s.outOfStock
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through"
                    : active
                      ? "border-green-700 bg-green-700 text-yellow-200"
                      : "border-green-200 bg-green-50 text-green-900 hover:border-green-400"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || selectedOutOfStock || (hasSizes && !size)}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${
            added
              ? "bg-emerald-600 text-white"
              : "bg-green-800 text-yellow-300 hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          }`}
        >
          {added ? (
            <>
              <Check className="size-4" /> เพิ่มแล้ว
            </>
          ) : (
            <>
              <Plus className="size-4" /> ใส่ตะกร้า
            </>
          )}
        </button>
        <Link
          href="/shop/cart"
          aria-label="ไปที่ตะกร้า"
          className="inline-flex size-9 items-center justify-center rounded-full border border-green-200 text-green-800 transition hover:bg-green-50"
        >
          <ShoppingCart className="size-4" />
        </Link>
      </div>
    </div>
  );
}
