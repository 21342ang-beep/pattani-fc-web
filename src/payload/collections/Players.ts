import type { CollectionConfig } from "payload";

export const Players: CollectionConfig = {
  slug: "players",
  labels: { singular: "ผู้เล่น", plural: "ผู้เล่น" },
  admin: {
    useAsTitle: "name",
    group: "เนื้อหา",
    defaultColumns: ["jerseyNumber", "name", "position", "active"],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "name", type: "text", label: "ชื่อ-นามสกุล", required: true },
    { name: "jerseyNumber", type: "number", label: "หมายเลขเสื้อ", min: 1, max: 99 },
    {
      name: "position",
      type: "select",
      label: "ตำแหน่ง",
      required: true,
      options: [
        { label: "ผู้รักษาประตู (GK)", value: "GK" },
        { label: "กองหลัง (DF)", value: "DF" },
        { label: "กองกลาง (MF)", value: "MF" },
        { label: "กองหน้า (FW)", value: "FW" },
      ],
    },
    { name: "nationality", type: "text", label: "สัญชาติ" },
    { name: "dateOfBirth", type: "date", label: "วันเกิด" },
    {
      name: "photo",
      type: "upload",
      relationTo: "media",
      label: "รูปผู้เล่น",
      required: false,
      admin: {
        description: "แนบไฟล์รูปผู้เล่นจากเครื่อง แทนการวาง URL รูปภาพ",
      },
    },
    { name: "active", type: "checkbox", label: "อยู่ในทีมชุดปัจจุบัน", defaultValue: true },
  ],
};
