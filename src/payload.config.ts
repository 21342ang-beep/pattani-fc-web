import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";

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

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

if (!process.env.PAYLOAD_SECRET) {
  throw new Error("PAYLOAD_SECRET ต้องตั้งค่าใน .env.local ก่อนรัน Payload");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ต้องตั้งค่า");
}

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || "http://localhost:3000",
  admin: {
    user: Users.slug,
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
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    schemaName: "payload",
    push: true,
  }),
  telemetry: false,
});
