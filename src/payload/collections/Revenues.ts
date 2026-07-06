import type { CollectionConfig } from "payload";

export const Revenues: CollectionConfig = {
  slug: "revenues",
  labels: { singular: "รายรับ", plural: "รายรับ" },
  admin: {
    useAsTitle: "title",
    group: "บัญชี",
    defaultColumns: ["recordedAt", "title", "category", "amountSatang"],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "recordedAt",
      type: "date",
      label: "วันที่บันทึก",
      required: true,
      admin: { date: { pickerAppearance: "dayOnly" } },
    },
    { name: "title", type: "text", label: "รายการ", required: true },
    {
      name: "category",
      type: "relationship",
      label: "หมวดบัญชี",
      relationTo: "account-categories",
      required: true,
      filterOptions: () => ({ type: { equals: "revenue" } }),
    },
    {
      name: "source",
      type: "select",
      label: "แหล่งที่มา",
      required: true,
      defaultValue: "ticket-sales",
      options: [
        { label: "ขายตั๋ว", value: "ticket-sales" },
        { label: "สปอนเซอร์", value: "sponsorship" },
        { label: "ขายสินค้า/Merchandise", value: "merchandise" },
        { label: "เงินรางวัล/Prize money", value: "prize-money" },
        { label: "อื่นๆ", value: "other" },
      ],
    },
    {
      name: "amountSatang",
      type: "number",
      label: "จำนวนเงิน (สตางค์)",
      required: true,
      min: 0,
      admin: { description: "จำนวนเงินเป็นสตางค์ — 100 บาท = 10000 สตางค์ (เลี่ยง floating point)" },
    },
    {
      name: "relatedMatchExternalId",
      type: "text",
      label: "Match ID (ถ้าเกี่ยวข้องกับแมตช์)",
      admin: { description: "อ้างอิง Match.id จากระบบ Prisma — ใส่ถ้ารายรับมาจากแมตช์เฉพาะ" },
    },
    { name: "notes", type: "textarea", label: "หมายเหตุ", maxLength: 1000 },
  ],
};
