"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, User, Ticket, KeyRound, LogOut } from "lucide-react";
import { logoutCustomer } from "@/app/actions/customer-auth";

const items = [
  { href: "/member", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/member/bookings", label: "ตั๋วของฉัน", icon: Ticket },
  { href: "/member/profile", label: "โปรไฟล์", icon: User },
  { href: "/member/change-password", label: "รหัสผ่าน", icon: KeyRound },
];

export default function MemberSubNav() {
  const path = usePathname();
  return (
    <div className="border-b border-green-200 bg-white/80 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        </div>
        <form action={logoutCustomer} className="shrink-0">
          <button className="inline-flex items-center gap-1.5 rounded-full border border-green-300 px-4 py-2 font-semibold text-green-800 transition hover:bg-green-800 hover:text-yellow-300">
            <LogOut className="size-4" />
            ออกจากระบบ
          </button>
        </form>
      </nav>
    </div>
  );
}
