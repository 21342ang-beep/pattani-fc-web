import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

// Data Access Layer — ตรวจ session ใกล้ data source ที่สุด
// ใช้ React cache เพื่อ memoize ภายใน render เดียว

export const verifySession = cache(async () => {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
});

export const verifyAdmin = cache(async () => {
  const session = await verifySession();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }
  return session;
});
