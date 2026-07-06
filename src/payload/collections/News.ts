import type { CollectionConfig } from "payload";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export const News: CollectionConfig = {
  slug: "news",
  labels: { singular: "ข่าวสาร", plural: "ข่าวสาร" },
  admin: { useAsTitle: "title", group: "เนื้อหา", defaultColumns: ["title", "publishedAt", "status"] },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "title", type: "text", label: "หัวข้อ", required: true },
    {
      name: "slug",
      type: "text",
      label: "Slug (URL)",
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          "ใช้เป็น URL ของหน้าข่าว เช่น 'renew-contract-2026' (a-z, 0-9, ขีดกลาง เท่านั้น)",
        placeholder: "renew-contract-2026",
      },
      validate: (value: unknown) => {
        if (typeof value !== "string" || !value.trim()) {
          return "กรุณาใส่ slug";
        }
        if (!SLUG_PATTERN.test(value)) {
          return "slug ใช้ได้เฉพาะ a-z, 0-9, ขีดกลาง (-) — ห้ามมีช่องว่าง / URL / สัญลักษณ์พิเศษ";
        }
        return true;
      },
    },
    {
      name: "summary",
      type: "textarea",
      label: "บทคัดย่อ",
      minLength: 50,
      maxLength: 5000,
      admin: {
        description: "ขั้นต่ำ 50 ตัวอักษร · สูงสุด 5,000 ตัวอักษร",
      },
    },
    { name: "body", type: "richText", label: "เนื้อหา" },
    {
      name: "cover",
      type: "upload",
      relationTo: "media",
      label: "รูปปก (อัปโหลด)",
      admin: {
        description:
          "อัปโหลดรูปจากเครื่อง — แนะนำให้ใช้แทน URL เพื่อความปลอดภัยและเร็วกว่า",
      },
    },
    {
      name: "coverImageUrl",
      type: "text",
      label: "URL รูปปก (ตัวเลือก / ใช้ถ้าไม่ได้อัปโหลด)",
      admin: {
        description:
          "ใช้เมื่อรูปอยู่บนเซิร์ฟเวอร์อื่น — ถ้ามี cover อัปโหลดด้านบนแล้ว ไม่ต้องใส่ที่นี่",
      },
    },
    { name: "publishedAt", type: "date", label: "วันที่เผยแพร่", admin: { date: { pickerAppearance: "dayAndTime" } } },
    {
      name: "status",
      type: "select",
      label: "สถานะ",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "ฉบับร่าง", value: "draft" },
        { label: "เผยแพร่", value: "published" },
        { label: "เก็บ", value: "archived" },
      ],
    },
  ],
};
