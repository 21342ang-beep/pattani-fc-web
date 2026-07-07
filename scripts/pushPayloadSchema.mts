// One-shot script: bootstrap Payload with NODE_ENV=development so that
// connect() runs pushDevSchema and syncs collections into the "payload" schema.
// Payload's connect.js skips schema push when NODE_ENV=production, so this
// script is invoked from deploy/setup.sh with NODE_ENV=development just for
// this bootstrap — PM2 still runs the app with NODE_ENV=production.
//
// File is .mts (ESM) because payload run uses top-level await via import(),
// which requires ESM. The project's package.json has no "type": "module",
// so .ts would be treated as CJS and TLA would fail.
//
// Usage:
//   NODE_ENV=development PAYLOAD_FORCE_DRIZZLE_PUSH=true \
//     npx payload run scripts/pushPayloadSchema.mts

import { getPayload } from "payload";
import config from "../src/payload.config.ts";

console.log("[push] NODE_ENV=", process.env.NODE_ENV);
const payload = await getPayload({ config });
console.log("[push] ✓ Payload schema push complete");
await payload.destroy();
process.exit(0);
