import type { CollectionConfig } from "payload";

export const Sponsors: CollectionConfig = {
  slug: "sponsors",
  labels: { singular: "ผู้สนับสนุน", plural: "ผู้สนับสนุน" },
  admin: { useAsTitle: "name", group: "เนื้อหา", defaultColumns: ["name", "tier", "active"] },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "name", type: "text", label: "ชื่อ", required: true },
    { name: "logoUrl", type: "text", label: "URL โลโก้" },
    { name: "website", type: "text", label: "เว็บไซต์" },
    {
      name: "tier",
      type: "select",
      label: "ระดับ",
      defaultValue: "supporter",
      options: [
        { label: "Title Sponsor", value: "title" },
        { label: "Main Sponsor", value: "main" },
        { label: "Official Partner", value: "partner" },
        { label: "Supporter", value: "supporter" },
      ],
    },
    { name: "active", type: "checkbox", label: "ใช้งานอยู่", defaultValue: true },
  ],
};
