import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
} from "payload";
import {
  hideFromNonSuperAdmins,
  superAdminFieldOnly,
  superAdminOnly,
  superAdminOrSelf,
} from "../access";

const preventLastSuperAdminDemotion: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
}) => {
  if (
    operation !== "update" ||
    originalDoc?.role !== "super-admin" ||
    data.role === undefined ||
    data.role === "super-admin"
  ) {
    return data;
  }
  // A check-then-write "last admin" count is race-prone when two requests run
  // concurrently. Super-admin removal is therefore a controlled maintenance
  // operation, never an ordinary CMS edit.
  throw new APIError("CMS super-admin accounts cannot be demoted here", 409);
};

const preventLastSuperAdminDelete: CollectionBeforeDeleteHook = async ({
  id,
  req,
}) => {
  const target = await req.payload.findByID({
    collection: "cms-users",
    id,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (target.role === "super-admin") {
    throw new APIError("CMS super-admin accounts cannot be deleted here", 409);
  }
};

export const Users: CollectionConfig = {
  slug: "cms-users",
  labels: {
    singular: "ผู้ดูแล CMS",
    plural: "ผู้ดูแล CMS",
  },
  admin: {
    useAsTitle: "email",
    group: "ระบบ",
    hidden: hideFromNonSuperAdmins,
  },
  auth: true,
  access: {
    read: superAdminOrSelf,
    create: superAdminOnly,
    update: superAdminOrSelf,
    delete: superAdminOnly,
  },
  hooks: {
    beforeChange: [preventLastSuperAdminDemotion],
    beforeDelete: [preventLastSuperAdminDelete],
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
      access: {
        create: superAdminFieldOnly,
        update: superAdminFieldOnly,
      },
      options: [
        { label: "ผู้ดูแลสูงสุด", value: "super-admin" },
        { label: "ผู้แก้ไข", value: "editor" },
        { label: "ฝ่ายบัญชี", value: "accountant" },
      ],
    },
  ],
};
