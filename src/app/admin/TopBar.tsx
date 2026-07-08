"use client";

import Image from "next/image";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { logout } from "@/app/actions/auth";

// Top bar เดียวของหน้าหลังบ้าน — 4 ปุ่ม: Payload CMS / ดูเว็บไซต์ / แก้ไขรหัสผ่าน / ออกจากระบบ
export default function TopBar({
  role,
  email,
}: {
  role: Role;
  email?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-yellow-300/10 bg-green-950 text-yellow-100 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/admin" className="flex items-center gap-3">
          <Image
            src="/logo-pattani-fc.png"
            alt="Pattani FC"
            width={36}
            height={36}
            priority
          />
          <div className="leading-tight">
            <div className="text-sm font-bold text-yellow-300 sm:text-base">
              Pattani FC
            </div>
            <div className="text-[10px] text-green-200 sm:text-[11px]">
              หลังบ้านผู้ดูแล
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-xs font-semibold text-yellow-300">{role}</div>
            {email && (
              <div className="max-w-[180px] truncate text-[11px] text-green-200">
                {email}
              </div>
            )}
          </div>

          <nav className="flex items-center gap-1 sm:gap-1.5">
            <TopBarLink href="/cms" icon="📝" label="Payload CMS" external />
            <TopBarLink href="/" icon="🌐" label="ดูเว็บไซต์" />
            <TopBarLink
              href="/admin/change-password"
              icon="🔑"
              label="แก้ไขรหัสผ่าน"
            />
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900/40 sm:text-sm"
                title="ออกจากระบบ"
              >
                <span aria-hidden>🚪</span>
                <span className="hidden md:inline">ออกจากระบบ</span>
              </button>
            </form>
          </nav>
        </div>
      </div>
    </header>
  );
}

function TopBarLink({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      title={label}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-yellow-100 hover:bg-green-900 sm:text-sm"
    >
      <span aria-hidden>{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
