import type { CollectionConfig } from "payload";

export const Expenses: CollectionConfig = {
  slug: "expenses",
  labels: { singular: "ค่าใช้จ่าย", plural: "ค่าใช้จ่าย" },
  admin: {
    useAsTitle: "title",
    group: "บัญชี",
    defaultColumns: ["recordedAt", "title", "category", "vendor", "amountSatang"],
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
      filterOptions: () => ({ type: { equals: "expense" } }),
    },
    {
      name: "expenseType",
      type: "select",
      label: "ประเภทค่าใช้จ่าย",
      required: true,
      defaultValue: "operations",
      options: [
        { label: "เงินเดือนนักเตะ/สตาฟ", value: "salaries" },
        { label: "ค่าเดินทาง", value: "travel" },
        { label: "ค่าสนาม/อุปกรณ์", value: "facilities" },
        { label: "ค่าโฆษณา/การตลาด", value: "marketing" },
        { label: "ค่าธรรมเนียม/ภาษี", value: "fees-tax" },
        { label: "ค่าใช้จ่ายดำเนินงาน", value: "operations" },
        { label: "อื่นๆ", value: "other" },
      ],
    },
    { name: "vendor", type: "text", label: "ผู้รับเงิน/Vendor" },
    {
      name: "amountSatang",
      type: "number",
      label: "จำนวนเงิน (สตางค์)",
      required: true,
      min: 0,
      admin: { description: "จำนวนเงินเป็นสตางค์ — 100 บาท = 10000 สตางค์" },
    },
    {
      name: "paymentStatus",
      type: "select",
      label: "สถานะการชำระ",
      required: true,
      defaultValue: "unpaid",
      options: [
        { label: "ยังไม่จ่าย", value: "unpaid" },
        { label: "จ่ายแล้ว", value: "paid" },
        { label: "ยกเลิก", value: "void" },
      ],
    },
    { name: "receiptUrl", type: "text", label: "URL ใบเสร็จ/หลักฐาน" },
    { name: "notes", type: "textarea", label: "หมายเหตุ", maxLength: 1000 },
  ],
};
