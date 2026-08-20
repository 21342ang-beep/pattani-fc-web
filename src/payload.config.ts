import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { pushDevSchema } from "@payloadcms/drizzle";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";

import { Users } from "./payload/collections/Users";
import { News } from "./payload/collections/News";
import { Sponsors } from "./payload/collections/Sponsors";
import { Players } from "./payload/collections/Players";
import { Staff } from "./payload/collections/Staff";
import { Management } from "./payload/collections/Management";
import { Media } from "./payload/collections/Media";
import { Products } from "./payload/collections/Products";
import { Promotions } from "./payload/collections/Promotions";
import { AccountCategories } from "./payload/collections/AccountCategories";
import { Revenues } from "./payload/collections/Revenues";
import { Expenses } from "./payload/collections/Expenses";
import { HomePage } from "./payload/globals/HomePage";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const MAX_MEDIA_UPLOAD_BYTES = 50 * 1024 * 1024;

if (!process.env.PAYLOAD_SECRET) {
  throw new Error("PAYLOAD_SECRET ต้องตั้งค่าใน .env.local ก่อนรัน Payload");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ต้องตั้งค่า");
}

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || "http://localhost:3000",
  // Runtime schema pushes are for local development or a fresh, explicitly
  // approved initialization window only. Normal production starts use reviewed
  // migrations and do not grant the app permission to alter its own schema.
  onInit: async (payload) => {
    const allowRuntimeSchemaPush =
      process.env.NODE_ENV !== "production" ||
      process.env.PAYLOAD_ALLOW_SCHEMA_PUSH === "true";
    if (!allowRuntimeSchemaPush) {
      payload.logger.info(
        "Payload runtime schema push disabled; use a controlled migration window",
      );
      return;
    }
    // Never DROP or rename media columns during application startup. Production
    // schema changes belong in a reviewed migration window, where a failure can
    // stop the release instead of leaving the CMS partially migrated.
    await pushDevSchema(payload.db as never);
    payload.logger.info("Payload schema push (explicitly enabled) complete");
  },
  admin: {
    user: Users.slug,
    components: {
      afterLogin: ["@/payload/components/CmsPasswordToggle"],
    },
    meta: {
      titleSuffix: " · Pattani FC CMS",
    },
  },
  routes: {
    admin: "/cms",
    api: "/payload-api",
    graphQL: "/payload-api/graphql",
    graphQLPlayground: "/payload-api/graphql-playground",
  },
  graphQL: {
    // Payload defaults this to true, but keep it explicit so a future default
    // change cannot expose the interactive explorer in production.
    disablePlaygroundInProduction: true,
  },
  collections: [
    Users,
    News,
    Sponsors,
    Players,
    Staff,
    Management,
    Media,
    Products,
    Promotions,
    AccountCategories,
    Revenues,
    Expenses,
  ],
  globals: [HomePage],
  editor: lexicalEditor(),
  sharp,
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  upload: {
    abortOnLimit: true,
    limits: {
      fileSize: MAX_MEDIA_UPLOAD_BYTES,
      files: 10,
      parts: 50,
    },
    responseOnLimit: "File size limit has been reached",
    uploadTimeout: 180_000,
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    schemaName: "payload",
    push:
      process.env.NODE_ENV !== "production" ||
      process.env.PAYLOAD_ALLOW_SCHEMA_PUSH === "true",
  }),
  telemetry: false,
});
