"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  readCart,
  removeItem,
  updateQty,
  type ShopCartItem,
  cartSubtotalBaht,
} from "@/lib/shop-cart";

export default function CartView() {
  const [items, setItems] = useState<ShopCartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
        กำลังโหลด...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <ShoppingBag className="mx-auto size-10 text-slate-300" />
        <p className="mt-3 text-lg font-semibold text-slate-500">
          ยังไม่มีสินค้าในตะกร้า
        </p>
        <Link
          href="/shop"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-green-800 px-5 py-2.5 text-sm font-bold text-yellow-300 hover:bg-green-900"
        >
          เลือกซื้อสินค้า <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  const subtotal = cartSubtotalBaht(items);

  return (
    <div className="grid gap-6 md:grid-cols-[1.6fr_1fr]">
      <ul className="space-y-3">
        {items.map((it) => {
          const key = `${it.productId}|${it.size ?? ""}`;
          return (
            <li
              key={key}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                {it.imageUrl ? (
                  <Image
                    src={it.imageUrl}
                    alt={it.name}
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <ShoppingBag className="size-7" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="line-clamp-2 text-sm font-bold text-green-900">
                  {it.name}
                </h3>
                {it.size && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    ไซส์: <span className="font-bold text-slate-700">{it.size}</span>
                  </p>
                )}
                <p className="mt-1 text-sm font-bold text-green-800">
                  {it.unitPriceBaht.toLocaleString("th-TH")} บาท
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center gap-0 overflow-hidden rounded-full border border-slate-200">
                    <button
                      type="button"
                      aria-label="ลดจำนวน"
                      onClick={() =>
                        setItems(updateQty(it.productId, it.size, it.quantity - 1))
                      }
                      className="px-2 py-1.5 text-slate-700 hover:bg-slate-100"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="min-w-[2rem] text-center text-sm font-bold">
                      {it.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="เพิ่มจำนวน"
                      onClick={() =>
                        setItems(updateQty(it.productId, it.size, it.quantity + 1))
                      }
                      className="px-2 py-1.5 text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems(removeItem(it.productId, it.size))}
                    className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="size-3.5" /> ลบ
                  </button>
                </div>
              </div>

              <div className="hidden flex-col items-end justify-between sm:flex">
                <span className="text-xs text-slate-500">ยอดรวม</span>
                <span className="text-base font-black text-green-900">
                  {(it.unitPriceBaht * it.quantity).toLocaleString("th-TH")} ฿
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-2xl border-2 border-green-100 bg-white p-5 shadow-sm md:sticky md:top-6">
        <h2 className="text-lg font-black text-green-900">สรุปคำสั่งซื้อ</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">ยอดสินค้า</dt>
            <dd className="font-bold text-slate-900">
              {subtotal.toLocaleString("th-TH")} ฿
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">ค่าจัดส่ง</dt>
            <dd className="text-slate-500">คำนวณในขั้นถัดไป</dd>
          </div>
        </dl>
        <div className="my-4 border-t border-slate-200" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-500">เริ่มต้น</span>
          <span className="text-2xl font-black text-green-900">
            {subtotal.toLocaleString("th-TH")} ฿
          </span>
        </div>
        <Link
          href="/shop/checkout"
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-yellow-400 px-5 py-3 text-base font-bold text-green-950 transition hover:bg-yellow-300"
        >
          ดำเนินการชำระเงิน <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/shop"
          className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-green-200 bg-white px-5 py-2.5 text-sm font-medium text-green-900 transition hover:bg-green-50"
        >
          เลือกซื้อต่อ
        </Link>
      </aside>
    </div>
  );
}
