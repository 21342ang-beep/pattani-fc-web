"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, User, Ticket, KeyRound } from "lucide-react";

const items = [
  { href: "/member", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/member/bookings", label: "การจองของฉัน", icon: Ticket },
  { href: "/member/profile", label: "โปรไฟล์", icon: User },
  { href: "/member/change-password", label: "รหัสผ่าน", icon: KeyRound },
];

export default function MemberSubNav() {
  const path = usePathname();
  return (
    <div className="border-b border-green-200 bg-white/80 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const Icon = it.icon;
          const active =
            it.href === "/member"
              ? path === "/member"
              : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 font-semibold transition ${
                active
                  ? "bg-green-800 text-yellow-300"
                  : "text-green-900 hover:bg-green-100"
              }`}
            >
              <Icon className="size-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
