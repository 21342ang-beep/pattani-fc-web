import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "cms-users",
  labels: {
    singular: "ผู้ดูแล CMS",
    plural: "ผู้ดูแล CMS",
  },
  admin: {
    useAsTitle: "email",
    group: "ระบบ",
  },
  auth: true,
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "ชื่อ",
    },
    {
      name: "role",
      type: "select",
      label: "สิทธิ์",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "ผู้ดูแลสูงสุด", value: "super-admin" },
        { label: "ผู้แก้ไข", value: "editor" },
        { label: "ฝ่ายบัญชี", value: "accountant" },
      ],
    },
  ],
};
