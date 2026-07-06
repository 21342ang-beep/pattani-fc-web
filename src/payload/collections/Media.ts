import path from "path";
import { fileURLToPath } from "url";
import type { CollectionConfig } from "payload";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "ไฟล์มีเดีย", plural: "ไฟล์มีเดีย" },
  admin: { useAsTitle: "filename", group: "เนื้อหา" },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    staticDir: path.resolve(dirname, "../../../public/uploads/media"),
    mimeTypes: ["image/*"],
    imageSizes: [
      { name: "thumb", width: 320, height: 320, position: "centre" },
      { name: "card", width: 640, height: 640, position: "centre" },
    ],
  },
  fields: [
    { name: "alt", type: "text", label: "คำอธิบายภาพ (alt)" },
  ],
};
