// One-shot script: bootstrap Payload with NODE_ENV=development so that
// connect() runs pushDevSchema and syncs collections into the "payload" schema.
// Payload's connect.js skips schema push when NODE_ENV=production, so this
// script is invoked from deploy/setup.sh with NODE_ENV=development just for
// this bootstrap — PM2 still runs the app with NODE_ENV=production.
//
// Usage:
//   NODE_ENV=development PAYLOAD_FORCE_DRIZZLE_PUSH=true \
//     npx payload run scripts/pushPayloadSchema.ts

import { getPayload } from "payload";
import config from "../src/payload.config";

const payload = await getPayload({ config });
payload.logger.info("✓ Payload schema push complete");
await payload.destroy();
process.exit(0);
