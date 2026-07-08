import "server-only";
import type { AuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCustomerSession } from "@/lib/customer-session";

// รวม logic upsert Customer + CustomerAccount + สร้าง session
// - ถ้า providerAccountId มีอยู่แล้ว → login
// - ถ้ายังไม่มี + intent=register + มีอีเมล + มี Customer เดิมด้วยอีเมลเดียวกัน → auto-link
// - ถ้ายังไม่มี + intent=register + ไม่มี Customer → create ใหม่พร้อม pdpaConsentAt
// - ถ้ายังไม่มี + intent=login → return error ให้ redirect ไป /register

export type OAuthSignInInput = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  intent: "register" | "login";
  pdpaConsent: boolean;
};

export type OAuthSignInResult =
  | { ok: true; customerId: string }
  | { ok: false; code: "no_account" | "no_email" | "missing_consent" | "conflict" };

export async function oauthSignIn(
  input: OAuthSignInInput,
): Promise<OAuthSignInResult> {
  const { provider, providerAccountId, email, name, intent, pdpaConsent } =
    input;

  // 1) มี CustomerAccount นี้อยู่แล้วไหม → login เลย
  const existingAccount = await prisma.customerAccount.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId },
    },
    include: { customer: true },
  });

  if (existingAccount) {
    await prisma.customer.update({
      where: { id: existingAccount.customerId },
      data: { lastLoginAt: new Date() },
    });
    await createCustomerSession(
      existingAccount.customer.id,
      existingAccount.customer.email,
      existingAccount.customer.name,
    );
    return { ok: true, customerId: existingAccount.customerId };
  }

  // 2) ยังไม่มีบัญชี — ถ้า intent=login refuse
  if (intent === "login") {
    return { ok: false, code: "no_account" };
  }

  // 3) intent=register — ต้องมี PDPA consent
  if (!pdpaConsent) {
    return { ok: false, code: "missing_consent" };
  }

  // 4) ต้องมีอีเมลถึงจะสร้างบัญชีได้ (LINE บาง case ไม่ส่ง email)
  if (!email) {
    return { ok: false, code: "no_email" };
  }

  // 5) มี Customer ที่อีเมลเดียวกันไหม → auto-link (provider ยืนยันอีเมลแล้ว)
  const existingCustomer = await prisma.customer.findUnique({
    where: { email },
  });

  const now = new Date();

  if (existingCustomer) {
    try {
      await prisma.customerAccount.create({
        data: {
          customerId: existingCustomer.id,
          provider,
          providerAccountId,
          providerEmail: email,
        },
      });
    } catch {
      return { ok: false, code: "conflict" };
    }
    await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: {
        lastLoginAt: now,
        // ตั้ง pdpaConsentAt เผื่อคนเก่ายังไม่ได้ยิน
        pdpaConsentAt: existingCustomer.pdpaConsentAt ?? now,
      },
    });
    await createCustomerSession(
      existingCustomer.id,
      existingCustomer.email,
      existingCustomer.name,
    );
    return { ok: true, customerId: existingCustomer.id };
  }

  // 6) สร้าง Customer + CustomerAccount ใหม่ใน transaction เดียว
  try {
    const created = await prisma.customer.create({
      data: {
        email,
        name: name ?? email.split("@")[0],
        passwordHash: null,
        emailVerifiedAt: now,
        lastLoginAt: now,
        pdpaConsentAt: now,
        accounts: {
          create: {
            provider,
            providerAccountId,
            providerEmail: email,
          },
        },
      },
    });
    await createCustomerSession(created.id, created.email, created.name);
    return { ok: true, customerId: created.id };
  } catch {
    return { ok: false, code: "conflict" };
  }
}
