import type { MetadataRoute } from "next";

// PWA manifest สำหรับติดตั้งหน้า /gate-check ลง home screen / desktop
// start_url ชี้ไปที่หน้า gate-check โดยตรง → เปิดทีก็พร้อมใช้
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pattani FC Gate Check",
    short_name: "GateCheck",
    description: "ระบบสแกนตั๋วเข้างาน Pattani FC (ใช้งานออฟไลน์ได้)",
    start_url: "/gate-check",
    scope: "/gate-check",
    display: "standalone",
    background_color: "#052e1b",
    theme_color: "#052e1b",
    orientation: "portrait",
    icons: [
      {
        src: "/logo-pattani-fc.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-pattani-fc.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
