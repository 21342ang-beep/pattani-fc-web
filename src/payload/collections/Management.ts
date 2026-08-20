import type { CollectionConfig } from "payload";
import {
  contentManagersOnly,
  hideFromNonContentManagers,
  publicRead,
} from "../access";

export const Management: CollectionConfig = {
  slug: "management",
  labels: { singular: "ผู้บริหาร", plural: "ผู้บริหาร" },
  admin: {
    useAsTitle: "name",
    group: "เนื้อหา",
    defaultColumns: ["name", "position", "order"],
    hidden: hideFromNonContentManagers,
  },
  access: {
    read: publicRead,
    create: contentManagersOnly,
    update: contentManagersOnly,
    delete: contentManagersOnly,
  },
  fields: [
    { name: "name", type: "text", label: "ชื่อ", required: true },
    { name: "position", type: "text", label: "ตำแหน่ง", required: true },
    { name: "photoUrl", type: "text", label: "URL รูป" },
    { name: "order", type: "number", label: "ลำดับการแสดง", defaultValue: 0 },
  ],
};
