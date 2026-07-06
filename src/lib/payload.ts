import "server-only";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";

// Cache Payload client across requests within a process (dev + prod)
let cached: Payload | undefined;

export async function payload(): Promise<Payload> {
  if (!cached) {
    cached = await getPayload({ config });
  }
  return cached;
}
