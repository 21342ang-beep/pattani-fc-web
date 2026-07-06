"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALES, type Locale } from "@/lib/i18n/dict";
import { LOCALE_COOKIE } from "@/lib/i18n/server";

// validate ขั้นต้นที่ runtime — รับเฉพาะค่าใน LOCALES enum
// กัน injection / arbitrary cookie value
export async function setLocale(value: string): Promise<void> {
  if (!LOCALES.includes(value as Locale)) return;
  const locale = value as Locale;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: false, // ไม่ต้องซ่อน — ไม่ใช่ข้อมูล sensitive, อ่านฝั่ง server เท่านั้น
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 ปี
  });

  // ให้ Next รีเฟรช server-rendered content ทุก route ที่ใช้ layout เดียวกัน
  revalidatePath("/", "layout");
}
