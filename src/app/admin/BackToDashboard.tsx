"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BackToDashboard() {
  const pathname = usePathname();
  if (pathname === "/admin") return null;

  return (
    <div className="mb-4">
      <Link
        href="/admin"
        className="inline-flex items-center rounded-md border border-green-200 bg-white px-3 py-1.5 text-sm font-medium text-green-900 shadow-sm transition hover:bg-green-50"
      >
        ← กลับไปที่หน้ารวม
      </Link>
    </div>
  );
}
