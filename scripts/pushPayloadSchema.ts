// One-shot script: bootstrap Payload with NODE_ENV=development so that
// connect() runs pushDevSchema and syncs collections into the "payload" schema.
// Payload's connect.js skips schema push when NODE_ENV=production, so this
// script is invoked from deploy/setup.sh with NODE_ENV=development just for
// this bootstrap — PM2 still runs the app with NODE_ENV=production.
//
// Usage:
//   NODE_ENV=development PAYLOAD_FORCE_DRIZZLE_PUSH=true \
//     npx payload run scripts/pushPayloadSchema.ts

import path from "path";
import { pathToFileURL } from "url";
import { getPayload } from "payload";

// Wrapped in async IIFE because `payload run` transpiles to CJS,
// which doesn't allow top-level await.
(async () => {
  const configPath = path.resolve(__dirname, "../src/payload.config.ts");
  const configModule = await import(pathToFileURL(configPath).href);
  const payload = await getPayload({ config: configModule.default });
  payload.logger.info("✓ Payload schema push complete");
  await payload.destroy();
  process.exit(0);
})();
