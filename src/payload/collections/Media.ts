import path from "path";
import { fileURLToPath } from "url";
import type { CollectionConfig } from "payload";
import {
  contentManagersOnly,
  hideFromNonContentManagers,
  publicRead,
} from "../access";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "ไฟล์มีเดีย", plural: "ไฟล์มีเดีย" },
  admin: {
    useAsTitle: "filename",
    group: "เนื้อหา",
    hidden: hideFromNonContentManagers,
  },
  access: {
    read: publicRead,
    create: contentManagersOnly,
    update: contentManagersOnly,
    delete: contentManagersOnly,
  },
  upload: {
    staticDir: path.resolve(dirname, "../../../public/uploads/media"),
    // Keep uploads to raster images and browser-safe video containers.
    // In particular, do not allow SVG because it can execute script when the
    // uploaded file is opened directly from our own origin.
    mimeTypes: [
      "image/avif",
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
    ],
    imageSizes: [
      { name: "thumb", width: 320, height: 320, position: "centre" },
      { name: "card", width: 640, height: 640, position: "centre" },
    ],
  },
  fields: [
    { name: "alt", type: "text", label: "คำอธิบายภาพ (alt)" },
  ],
};
