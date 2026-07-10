import "server-only";
import type { AuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCustomerSession } from "@/lib/customer-session";
import type { OAuthPendingProfile } from "@/lib/oauth";

// รวม logic upsert Customer + CustomerAccount + สร้าง session
// - ถ้า providerAccountId มีอยู่แล้ว → login
// - ถ้ายังไม่มี + intent=register:
//     • email ที่ใช้ = อีเมล verified ของ provider เป็นหลัก (ปลอดภัยกว่าที่ลูกค้ากรอก)
//       ถ้า provider ไม่ส่ง email (LINE บาง case) จึง fallback อีเมลที่กรอก
//     • มี Customer เดิมด้วยอีเมลนั้น → auto-link (ไม่แตะ password/name/phone เดิม)
//     • ไม่มี Customer → create ใหม่ (hybrid: มี passwordHash จากฟอร์มถ้ามี profile)
// - ถ้ายังไม่มี + intent=login → return error ให้ redirect ไป /register
//
// profile = ข้อมูลที่ลูกค้ากรอกในฟอร์มสมัคร (flow "กรอกก่อน แล้วผูก social")
// emailChanged = true เมื่ออีเมลที่กรอก ≠ อีเมล verified ของ provider → แจ้งเตือนลูกค้า

export type OAuthSignInInput = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  intent: "register" | "login";
  pdpaConsent: boolean;
  profile?: OAuthPendingProfile;
};

export type OAuthSignInResult =
  | { ok: true; customerId: string; emailChanged: boolean }
  | { ok: false; code: "no_account" | "no_email" | "missing_consent" | "conflict" };

export async function oauthSignIn(
  input: OAuthSignInInput,
): Promise<OAuthSignInResult> {
  const { provider, providerAccountId, email, name, intent, pdpaConsent, profile } =
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
    return { ok: true, customerId: existingAccount.customerId, emailChanged: false };
  }

  // 2) ยังไม่มีบัญชี — ถ้า intent=login refuse
  if (intent === "login") {
    return { ok: false, code: "no_account" };
  }

  // 3) intent=register — ต้องมี PDPA consent
  if (!pdpaConsent) {
    return { ok: false, code: "missing_consent" };
  }

  // 4) ตัดสินอีเมลที่จะใช้ — ยึดอีเมล verified ของ provider ก่อนเสมอ
  //    (กันคนกรอกอีเมลที่ตัวเองไม่ได้เป็นเจ้าของ แล้วผูก social ของตัวเองมาสวม)
  const providerEmail = email; // verified โดย provider (Google เช็ค emailVerified มาแล้ว)
  const typedEmail = profile?.email ?? null;
  const finalEmail = providerEmail ?? typedEmail;
  if (!finalEmail) {
    return { ok: false, code: "no_email" };
  }
  // อีเมลถูก "เปลี่ยน" ก็ต่อเมื่อ provider ส่งอีเมลมา และไม่ตรงกับที่กรอก
  const emailChanged = !!(
    providerEmail &&
    typedEmail &&
    providerEmail !== typedEmail
  );

  const now = new Date();

  // 5) มี Customer ที่อีเมลนั้นอยู่แล้วไหม → auto-link (ไม่แตะข้อมูลเดิมของเขา)
  const existingCustomer = await prisma.customer.findUnique({
    where: { email: finalEmail },
  });

  if (existingCustomer) {
    try {
      await prisma.customerAccount.create({
        data: {
          customerId: existingCustomer.id,
          provider,
          providerAccountId,
          providerEmail,
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
        // ถ้าบัญชีเดิมเป็น social-only (ยังไม่มีรหัสผ่าน) และลูกค้ากรอกรหัสมา → เพิ่มให้
        // ไม่ overwrite รหัสผ่านเดิมเด็ดขาด (กัน takeover)
        ...(existingCustomer.passwordHash == null && profile?.passwordHash
          ? { passwordHash: profile.passwordHash }
          : {}),
      },
    });
    await createCustomerSession(
      existingCustomer.id,
      existingCustomer.email,
      existingCustomer.name,
    );
    return { ok: true, customerId: existingCustomer.id, emailChanged };
  }

  // 6) สร้าง Customer + CustomerAccount ใหม่ใน transaction เดียว
  //    passwordHash มาจากฟอร์ม (hybrid) — social-only flow เดิมจะเป็น null
  //    emailVerifiedAt: ตั้งเฉพาะเมื่ออีเมลมาจาก provider (verified) เท่านั้น
  try {
    const created = await prisma.customer.create({
      data: {
        email: finalEmail,
        name: profile?.name ?? name ?? finalEmail.split("@")[0],
        phone: profile?.phone ?? null,
        passwordHash: profile?.passwordHash ?? null,
        emailVerifiedAt: providerEmail ? now : null,
        lastLoginAt: now,
        pdpaConsentAt: now,
        accounts: {
          create: {
            provider,
            providerAccountId,
            providerEmail,
          },
        },
      },
    });
    await createCustomerSession(created.id, created.email, created.name);
    return { ok: true, customerId: created.id, emailChanged };
  } catch {
    return { ok: false, code: "conflict" };
  }
}
