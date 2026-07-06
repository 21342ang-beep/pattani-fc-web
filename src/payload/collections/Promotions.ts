import type { CollectionConfig } from "payload";

export const Promotions: CollectionConfig = {
  slug: "promotions",
  labels: { singular: "กิจกรรม/โปรโมชั่น", plural: "กิจกรรม/โปรโมชั่น" },
  admin: {
    useAsTitle: "title",
    group: "กิจกรรม",
    defaultColumns: ["title", "type", "startAt", "endAt", "active"],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "title", type: "text", label: "ชื่อกิจกรรม", required: true },
    {
      name: "type",
      type: "select",
      label: "ประเภท",
      defaultValue: "lucky_draw",
      options: [
        { label: "ลุ้นรางวัล (Lucky Draw)", value: "lucky_draw" },
        { label: "โปรโมชั่นพิเศษ", value: "promo" },
        { label: "ส่วนลด", value: "discount" },
        { label: "กิจกรรมพิเศษ", value: "event" },
      ],
    },
    {
      name: "cover",
      type: "upload",
      relationTo: "media",
      label: "รูปปก",
    },
    {
      name: "summary",
      type: "text",
      label: "สรุปสั้นๆ",
      admin: { description: "แสดงบนการ์ดรายการ" },
    },
    {
      name: "description",
      type: "textarea",
      label: "รายละเอียดเต็ม",
    },
    {
      name: "prize",
      type: "text",
      label: "รางวัล",
      admin: { description: "เช่น เสื้อแข่ง 5 รางวัล, บัตรเข้าชม VIP" },
    },
    {
      name: "startAt",
      type: "date",
      label: "วันเริ่ม",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "endAt",
      type: "date",
      label: "วันสิ้นสุด",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "memberOnly",
      type: "checkbox",
      label: "เฉพาะสมาชิก",
      defaultValue: true,
    },
    {
      name: "active",
      type: "checkbox",
      label: "เปิดแสดงผล",
      defaultValue: true,
    },
  ],
};
