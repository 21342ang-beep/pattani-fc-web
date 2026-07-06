import type { CollectionConfig } from "payload";

export const Products: CollectionConfig = {
  slug: "products",
  labels: { singular: "สินค้า", plural: "สินค้า" },
  admin: {
    useAsTitle: "name",
    group: "ร้านค้า",
    defaultColumns: ["name", "price", "category", "active"],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "name", type: "text", label: "ชื่อสินค้า", required: true },
    {
      name: "slug",
      type: "text",
      label: "Slug (URL)",
      admin: { description: "เว้นว่างได้ ระบบจะใช้ชื่อสินค้าแทน" },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      label: "รูปสินค้า",
      required: true,
    },
    {
      name: "gallery",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      label: "รูปเพิ่มเติม (gallery)",
    },
    {
      name: "price",
      type: "number",
      label: "ราคา (บาท)",
      required: true,
      min: 0,
      admin: { step: 1 },
    },
    {
      name: "salePrice",
      type: "number",
      label: "ราคาลด (บาท)",
      min: 0,
      admin: { description: "เว้นว่างถ้าไม่มีส่วนลด" },
    },
    {
      name: "sizes",
      type: "array",
      label: "ไซส์ที่มี",
      labels: { singular: "ไซส์", plural: "ไซส์" },
      admin: {
        description: "เว้นว่างถ้าสินค้าไม่มีไซส์ (เช่น ของที่ระลึก)",
      },
      fields: [
        {
          name: "label",
          type: "text",
          label: "ไซส์",
          required: true,
          admin: { description: "เช่น S, M, L, XL, 38, 40" },
        },
        {
          name: "stock",
          type: "number",
          label: "สต็อก",
          min: 0,
          defaultValue: 0,
        },
      ],
    },
    {
      name: "category",
      type: "select",
      label: "หมวดหมู่",
      defaultValue: "merch",
      options: [
        { label: "เสื้อแข่ง (Jersey)", value: "jersey" },
        { label: "เสื้อผ้าทั่วไป (Apparel)", value: "apparel" },
        { label: "ของที่ระลึก (Merch)", value: "merch" },
        { label: "อุปกรณ์ (Accessories)", value: "accessories" },
      ],
    },
    {
      name: "description",
      type: "textarea",
      label: "รายละเอียดสินค้า",
    },
    {
      name: "active",
      type: "checkbox",
      label: "เปิดขาย",
      defaultValue: true,
    },
  ],
};
