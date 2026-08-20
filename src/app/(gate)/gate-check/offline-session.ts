import "server-only";

import { createHmac } from "node:crypto";
import { redirect } from "next/navigation";
import { verifyPermission } from "@/lib/dal";
import { readSession } from "@/lib/session";
import { deriveSecurityKey } from "@/lib/security-keys";
import {
  clampGateOfflineExpiry,
  type GateOfflineSession,
} from "./offline-policy";

const bindingKey = deriveSecurityKey("pattani-fc/gate-offline-session/v1");

export async function createGateOfflineSession(): Promise<GateOfflineSession> {
  const [user, session] = await Promise.all([
    verifyPermission("GATE_CHECK"),
    readSession(),
  ]);
  if (!session) redirect("/login?reauth=1");

  const expiresAt = clampGateOfflineExpiry(session.expiresAt);
  if (expiresAt <= Date.now()) redirect("/login?reauth=1");

  const id = createHmac("sha256", bindingKey)
    .update(user.id)
    .update("\0")
    .update(String(session.iat ?? 0))
    .update("\0")
    .update(String(session.expiresAt))
    .digest("hex");

  return { id, expiresAt };
}
