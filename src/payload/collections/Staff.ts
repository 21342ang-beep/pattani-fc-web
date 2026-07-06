import type { CollectionConfig } from "payload";

export const Staff: CollectionConfig = {
  slug: "staff",
  labels: { singular: "ทีมงานสตาฟ", plural: "ทีมงานสตาฟ" },
  admin: { useAsTitle: "name", group: "เนื้อหา", defaultColumns: ["name", "role"] },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "name", type: "text", label: "ชื่อ", required: true },
    {
      name: "role",
      type: "select",
      label: "ตำแหน่ง",
      required: true,
      options: [
        { label: "หัวหน้าผู้ฝึกสอน", value: "head-coach" },
        { label: "ผู้ช่วยผู้ฝึกสอน", value: "asst-coach" },
        { label: "โค้ชผู้รักษาประตู", value: "gk-coach" },
        { label: "นักกายภาพ", value: "physio" },
        { label: "ผู้ดูแลทีม", value: "team-manager" },
        { label: "อื่นๆ", value: "other" },
      ],
    },
    { name: "photoUrl", type: "text", label: "URL รูป" },
  ],
};
