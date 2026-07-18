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
            {
              name: "mainboardType",
              type: "select",
              label: "ประเภทสื่อ",
              defaultValue: "image",
              required: true,
              options: [
                { label: "รูปภาพ", value: "image" },
                { label: "วิดีโอ", value: "video" },
              ],
            },
            {
              name: "mainboardImage",
              type: "upload",
              relationTo: "media",
              label: "รูปภาพ Mainboard",
              admin: {
                description: "แนะนำภาพแนวนอนอัตราส่วนใกล้เคียง 1584 × 672 พิกเซล",
                condition: (_, siblingData) => siblingData.mainboardType !== "video",
              },
            },
            {
              name: "mainboardSlides",
              type: "upload",
              relationTo: "media",
              hasMany: true,
              label: "ภาพสไลด์ Mainboard",
              admin: {
                description: "แนบได้หลายภาพ ภาพจะเลื่อนอัตโนมัติทุก 3 วินาที และผู้ชมกดเลื่อนซ้าย-ขวาได้",
                condition: (_, siblingData) => siblingData.mainboardType !== "video",
              },
            },
            {
              name: "mainboardVideo",
              type: "upload",
              relationTo: "media",
              label: "วิดีโอ Mainboard",
              admin: {
                description: "รองรับไฟล์ MP4 หรือ WebM และจะแสดงแบบเล่นวนอัตโนมัติโดยไม่มีเสียง",
                condition: (_, siblingData) => siblingData.mainboardType === "video",
              },
            },
          ],
        },
      ],
    },
  ],
};
