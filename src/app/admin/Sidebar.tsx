"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

type Item = {
  href: string;
  label: string;
  icon: string;
  match?: (p: string) => boolean;
};

type Section = { title: string; items: Item[] };

function buildSections(isSuperAdmin: boolean): Section[] {
  const sections: Section[] = [
    {
      title: "หลัก",
      items: [
        { href: "/admin", label: "ภาพรวม", icon: "📊", match: (p) => p === "/admin" },
        {
          href: "/admin/matches",
          label: "จัดการแมตช์",
          icon: "⚽",
          match: (p) => p.startsWith("/admin/matches") && !p.endsWith("/new"),
        },
        {
          href: "/admin/matches/new",
          label: "เพิ่มแมตช์ใหม่",
          icon: "➕",
          match: (p) => p === "/admin/matches/new",
        },
        {
          href: "/admin/bookings",
          label: "การจอง (รายแมตช์)",
          icon: "🎟️",
          match: (p) => p.startsWith("/admin/bookings"),
        },
        {
          href: "/admin/season-passes",
          label: "บัตรรายปี",
          icon: "🏆",
          match: (p) => p.startsWith("/admin/season-passes"),
        },
        {
          href: "/gate-check",
          label: "สแกนเข้างาน (Offline)",
          icon: "📷",
          match: (p) => p.startsWith("/gate-check"),
        },
        {
          href: "/admin/customers",
          label: "ลูกค้า",
          icon: "👨‍👩‍👧",
          match: (p) => p.startsWith("/admin/customers"),
        },
      ],
    },
    {
      title: "เนื้อหา",
      items: [
        {
          href: "/admin/website",
          label: "จัดการหน้าเว็บไซต์",
          icon: "🌐",
          match: (p) => p.startsWith("/admin/website"),
        },
      ],
    },
    {
      title: "รายงาน",
      items: [
        {
          href: "/admin/reports",
          label: "รายงานยอดขาย",
          icon: "📈",
          match: (p) => p.startsWith("/admin/reports"),
        },
        {
          href: "/admin/finance",
          label: "การเงิน (CMS)",
          icon: "💰",
          match: (p) => p.startsWith("/admin/finance"),
        },
      ],
    },
    {
      title: "บัญชีของฉัน",
      items: [
        {
          href: "/admin/profile",
          label: "โปรไฟล์ฉัน",
          icon: "👤",
          match: (p) => p.startsWith("/admin/profile"),
        },
      ],
    },
  ];

  if (isSuperAdmin) {
    sections.push({
      title: "จัดการระบบ",
      items: [
        {
          href: "/admin/users",
          label: "ผู้ดูแลระบบ",
          icon: "👥",
          match: (p) => p.startsWith("/admin/users"),
        },
      ],
    });
  }

  return sections;
}

export default function Sidebar({
  role,
  email,
}: {
  role: "ADMIN" | "SUPER_ADMIN";
  email?: string;
}) {
  const path = usePathname();
  const sections = buildSections(role === "SUPER_ADMIN");

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-green-900/20 bg-green-950 text-yellow-100 md:flex">
        <Link
          href="/admin"
          className="flex items-center gap-3 border-b border-yellow-300/10 px-5 py-4"
        >
          <Image
            src="/logo-pattani-fc.png"
            alt="Pattani FC"
            width={40}
            height={40}
            priority
          />
          <div>
            <div className="text-base font-bold text-yellow-300">Pattani FC</div>
            <div className="text-[11px] text-green-200">หลังบ้านผู้ดูแล</div>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((sec) => (
            <div key={sec.title} className="mb-4">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-green-300/70">
                {sec.title}
              </p>
              <div className="space-y-1">
                {sec.items.map((it) => {
                  const active = it.match
                    ? it.match(path)
                    : path === it.href;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-yellow-400 text-green-950 font-semibold"
                          : "text-yellow-100 hover:bg-green-900"
                      }`}
                    >
                      <span aria-hidden className="text-base">
                        {it.icon}
                      </span>
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-yellow-300/10 px-3 py-3 text-xs">
          <div className="mb-2 px-2">
            <div className="font-semibold text-yellow-300">{role}</div>
            {email && (
              <div className="truncate text-[11px] text-green-200">{email}</div>
            )}
          </div>
          <Link
            href="/cms"
            target="_blank"
            rel="noopener"
            className="mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-yellow-100 hover:bg-green-900"
          >
            <span aria-hidden>📝</span>
            <span>เปิด Payload CMS</span>
          </Link>
          <Link
            href="/"
            className="mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-yellow-100 hover:bg-green-900"
          >
            <span aria-hidden>🌐</span>
            <span>ดูเว็บไซต์</span>
          </Link>
          <Link
            href="/admin/change-password"
            className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
              path === "/admin/change-password"
                ? "bg-yellow-400 font-semibold text-green-950"
                : "text-yellow-100 hover:bg-green-900"
            }`}
          >
            <span aria-hidden>🔑</span>
            <span>แก้ไขรหัสผ่าน</span>
          </Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-red-200 hover:bg-red-900/40">
              <span aria-hidden>🚪</span>
              <span>ออกจากระบบ</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="sticky top-0 z-20 border-b border-yellow-500/40 bg-yellow-400 text-green-950 md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/logo-pattani-fc.png"
              alt="Pattani FC"
              width={32}
              height={32}
            />
            <span className="text-sm font-bold">Pattani FC Admin</span>
          </Link>
          <form action={logout}>
            <button className="rounded-md bg-green-800 px-3 py-1 text-xs font-semibold text-yellow-300 hover:bg-green-900">
              ออก
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-yellow-500/30 px-2 py-2 text-xs">
          {sections.flatMap((s) => s.items).map((it) => {
            const active = it.match ? it.match(path) : path === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 font-medium ${
                  active
                    ? "bg-green-800 text-yellow-300"
                    : "hover:bg-yellow-300"
                }`}
              >
                <span aria-hidden>{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
