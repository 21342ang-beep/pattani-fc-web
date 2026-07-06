import type { Metadata } from "next";

// หมายเหตุ: root layout ตั้งใจให้ไม่มี <html><body>
// เพราะแต่ละ route group มี layout ของตัวเอง
// - (public)/layout.tsx มี <html><body> + font + locale
// - (payload)/layout.tsx ใช้ RootLayout ของ Payload ที่มี <html><body> ในตัว
// ถ้าใส่ <html> ที่นี่ด้วย จะกลายเป็น nested html → hydration error

export const metadata: Metadata = {
  title: "Pattani FC — จองตั๋วฟุตบอลออนไลน์",
  description: "ระบบจองตั๋วการแข่งขันอย่างเป็นทางการของสโมสรปัตตานี เอฟซี",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
