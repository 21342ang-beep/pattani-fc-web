import type { CollectionConfig } from "payload";
import {
  financeManagersOnly,
  hideFromNonFinanceManagers,
} from "../access";

export const AccountCategories: CollectionConfig = {
  slug: "account-categories",
  labels: { singular: "ผังบัญชี", plural: "ผังบัญชี" },
  admin: {
    useAsTitle: "name",
    group: "บัญชี",
    defaultColumns: ["code", "name", "type"],
    hidden: hideFromNonFinanceManagers,
  },
  access: {
    read: financeManagersOnly,
    create: financeManagersOnly,
    update: financeManagersOnly,
    delete: financeManagersOnly,
  },
  fields: [
    { name: "code", type: "text", label: "รหัสบัญชี", required: true, unique: true, index: true },
    { name: "name", type: "text", label: "ชื่อบัญชี", required: true },
    {
      name: "type",
      type: "select",
      label: "ประเภท",
      required: true,
      options: [
        { label: "รายรับ", value: "revenue" },
        { label: "ค่าใช้จ่าย", value: "expense" },
      ],
    },
    { name: "description", type: "textarea", label: "คำอธิบาย", maxLength: 500 },
  ],
};
