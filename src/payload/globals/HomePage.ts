import type { GlobalConfig } from "payload";

export const HomePage: GlobalConfig = {
  slug: "home-page",
  label: "หน้าแรก",
  admin: {
    group: "การตั้งค่าเว็บไซต์",
    description: "จัดการสื่อ Mainboard ที่แสดงบนหน้าแรกของเว็บไซต์",
  },
  access: {
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Mainboard หน้าแรก",
          fields: [
            // เก็บ field เดิมไว้เพื่อไม่ให้ Payload ลบข้อมูลที่เคยอัปโหลด
            // แต่ซ่อนออกจาก CMS แล้ว โดยให้ใช้งาน mainboardSlides เพียงช่องเดียว
            {
              name: "mainboardType",
              type: "select",
              options: [
                { label: "รูปภาพ", value: "image" },
                { label: "วิดีโอ", value: "video" },
              ],
              admin: { hidden: true },
            },
            {
              name: "mainboardImage",
              type: "upload",
              relationTo: "media",
              admin: { hidden: true },
            },
            {
              name: "mainboardVideo",
              type: "upload",
              relationTo: "media",
              admin: { hidden: true },
            },
            {
              name: "mainboardSlides",
              type: "upload",
              relationTo: "media",
              hasMany: true,
              label: "สไลด์ Mainboard",
              admin: {
                description: "แนบได้หลายไฟล์ ทั้งรูปภาพและวิดีโอ MP4/WebM ตามลำดับที่ต้องการแสดง สไลด์จะเลื่อนอัตโนมัติทุก 3 วินาที และผู้ชมกดเลื่อนซ้าย-ขวาได้",
              },
            },
          ],
        },
      ],
    },
  ],
};
