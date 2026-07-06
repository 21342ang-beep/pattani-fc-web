"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cartCount, readCart } from "@/lib/shop-cart";

export default function CartLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(cartCount(readCart()));
    refresh();
    window.addEventListener("shop-cart:change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shop-cart:change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <Link
      href="/shop/cart"
      className="relative inline-flex items-center gap-2 rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-900 transition hover:bg-green-50"
    >
      <ShoppingCart className="size-4" />
      ตะกร้าสินค้า
      {count > 0 && (
        <span
          aria-label={`${count} ชิ้นในตะกร้า`}
          className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-yellow-400 px-1.5 py-0.5 text-[11px] font-black text-green-950"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
