import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { pushDevSchema } from "@payloadcms/drizzle";
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
import { HomePage } from "./payload/globals/HomePage";

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
  // Payload's connect() skips pushDevSchema when NODE_ENV=production
  // (see @payloadcms/db-postgres/dist/connect.js). We run the app in
  // production, so tables like payload.sponsors never get created.
  // Trigger the push explicitly in onInit — idempotent, drizzle-kit compares
  // schema and only applies deltas.
  onInit: async (payload) => {
    if (process.env.PAYLOAD_SKIP_INIT_PUSH === "true") return;
    // One-off self-healing migration: sponsors.logoUrl (text) was replaced by a
    // logo upload relation (logo_id). Doing the DROP + ADD together makes
    // drizzle-kit push ask an interactive "is this a rename?" prompt, which
    // hangs a non-TTY server (prod/PM2) forever. Pre-apply the column change
    // idempotently so the push below finds no ambiguity and only adds the
    // FK/index silently. All statements are IF EXISTS / IF NOT EXISTS, so this
    // is a no-op on a fresh DB and safe to leave in place; remove once every
    // environment has migrated.
    try {
      const db = payload.db as unknown as {
        drizzle: unknown;
        execute: (args: {
          drizzle: unknown;
          raw: string;
        }) => Promise<unknown>;
      };
      // execute() runs on `db ?? drizzle` internally, so the drizzle handle
      // must be passed explicitly or it dereferences undefined.
      await db.execute({
        drizzle: db.drizzle,
        raw: "ALTER TABLE IF EXISTS payload.sponsors DROP COLUMN IF EXISTS logo_url",
      });
      await db.execute({
        drizzle: db.drizzle,
        raw: "ALTER TABLE IF EXISTS payload.sponsors ADD COLUMN IF NOT EXISTS logo_id integer",
      });
    } catch (err) {
      payload.logger.warn({
        err,
        msg: "sponsors logo column pre-migration skipped",
      });
    }
    try {
      await pushDevSchema(payload.db as never);
      payload.logger.info("✓ Payload schema push (onInit) complete");
    } catch (err) {
      payload.logger.error({ err, msg: "Payload schema push failed" });
    }
  },
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
  globals: [HomePage],
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
