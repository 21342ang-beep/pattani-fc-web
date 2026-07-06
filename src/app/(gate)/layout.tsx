import type { Metadata } from "next";
import localFont from "next/font/local";
import { verifyAdmin } from "@/lib/dal";
import "../globals.css";

// Layout แยกสำหรับหน้า /gate-check
// - ไม่ใช้ admin sidebar เพื่อให้หน้าจอเต็ม (พนักงานคุมประตูใช้สแกน)
// - verifyAdmin ตอน load ครั้งแรก → ต้อง login admin ก่อนจะใช้งาน offline ได้
// - มี <html> เองเหมือน (public)/layout.tsx (root layout ไม่มี html/body)
//   เพราะแต่ละ route group มี layout ของตัวเอง

const dbHeavent = localFont({
  src: "../../fonts/DBHeaventMed.ttf",
  variable: "--font-db-heavent",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gate Check — Pattani FC",
  description: "ระบบสแกนตั๋วเข้างาน (ใช้งาน offline ได้)",
};

export const dynamic = "force-dynamic";

export default async function GateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifyAdmin();
  return (
    <html lang="th" className={`${dbHeavent.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
