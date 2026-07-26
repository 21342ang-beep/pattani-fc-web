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
      <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-3 px-4 py-3 sm:gap-5 sm:py-4 md:px-8">
        <Link href="/admin" className="flex items-center gap-3 xl:translate-x-28 2xl:translate-x-56">
          <Image
            src="/logo-pattani-fc.png"
            alt="Pattani FC"
            width={48}
            height={48}
            priority
            className="size-10 sm:size-12"
          />
          <div className="leading-tight">
            <div className="text-base font-bold text-yellow-300 sm:text-lg">
              Pattani FC
            </div>
            <div className="text-xs text-green-200 sm:text-sm">
              หลังบ้านผู้ดูแล
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4 xl:-translate-x-40 2xl:-translate-x-80">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-semibold text-yellow-300 lg:text-base">{role}</div>
            {email && (
              <div className="max-w-[200px] truncate text-xs text-green-200 lg:text-sm">
                {email}
              </div>
            )}
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
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
                className="flex size-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-red-200 hover:bg-red-900/40 sm:size-auto sm:px-3 sm:py-2 sm:text-base lg:px-4 lg:py-2.5 lg:text-lg"
                title="ออกจากระบบ"
              >
                <span aria-hidden>🚪</span>
                <span className="hidden lg:inline">ออกจากระบบ</span>
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
      className="flex size-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-yellow-100 hover:bg-green-900 sm:size-auto sm:px-3 sm:py-2 sm:text-base lg:px-4 lg:py-2.5 lg:text-lg"
    >
      <span aria-hidden>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
