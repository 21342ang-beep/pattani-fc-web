import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const securityHeaders = [
  // กัน clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // กัน MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // ไม่ส่ง Referer ข้าม origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // ปิด APIs ที่ไม่จำเป็น
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // กันการโหลด cross-origin โดยไม่ตั้งใจ (Spectre mitigation)
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Server Action body limit — รับโล้โก้ 2 ทีม × 2MB + form fields
  // (default 1MB ไม่พอ → block ก่อน server validate รัน)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // /sw.js — ห้าม cache เพื่อให้ผู้ใช้ได้ service worker เวอร์ชันใหม่เสมอ
      // (ดู PWA guide ของ Next.js)
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
