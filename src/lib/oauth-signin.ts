import "server-only";
import type { AuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCustomerSession } from "@/lib/customer-session";
import type { OAuthPendingProfile } from "@/lib/oauth";
import { canAutoLinkOAuthCustomer } from "@/lib/oauth-link-policy";

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
  | {
      ok: false;
      code:
        | "no_account"
        | "no_email"
        | "missing_consent"
        | "link_verification_required"
        | "conflict";
    };

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
  const providerEmail = email?.trim().toLowerCase() ?? null;
  const typedEmail = profile?.email ?? null;
  // A typed address is not proof of ownership. In particular, LINE may omit
  // its verified email claim; falling back here would allow account takeover.
  if (!providerEmail) {
    return { ok: false, code: "no_email" };
  }
  const finalEmail = providerEmail;
  // อีเมลถูก "เปลี่ยน" ก็ต่อเมื่อ provider ส่งอีเมลมา และไม่ตรงกับที่กรอก
  const emailChanged = !!(
    providerEmail &&
    typedEmail &&
    providerEmail !== typedEmail
  );

  const now = new Date();

  // 5) มี Customer ที่อีเมลนั้นอยู่แล้วไหม → auto-link (ไม่แตะข้อมูลเดิมของเขา)
  const existingCustomer = await prisma.customer.findFirst({
    where: { email: { equals: finalEmail, mode: "insensitive" } },
  });

  if (existingCustomer) {
    // A matching address that was merely typed during password registration
    // is not proof of ownership. Linking it would let a pre-registration
    // attacker keep password access after the real owner signs in with OAuth.
    if (!canAutoLinkOAuthCustomer(existingCustomer.emailVerifiedAt)) {
      return { ok: false, code: "link_verification_required" };
    }

    try {
      const linkedCustomer = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${existingCustomer.id} FOR UPDATE`;
        const lockedCustomer = await tx.customer.findUnique({
          where: { id: existingCustomer.id },
        });
        if (
          !lockedCustomer ||
          lockedCustomer.email.trim().toLowerCase() !== finalEmail ||
          !canAutoLinkOAuthCustomer(lockedCustomer.emailVerifiedAt)
        ) {
          throw new Error("OAuth link owner changed during verification");
        }

        await tx.customerAccount.create({
          data: {
            customerId: existingCustomer.id,
            provider,
            providerAccountId,
            providerEmail,
          },
        });

        return tx.customer.update({
          where: { id: existingCustomer.id },
          data: {
            lastLoginAt: now,
            pdpaConsentAt: lockedCustomer.pdpaConsentAt ?? now,
            // Invalidate sessions issued before this new login method was
            // attached. The session created below gets the new auth version.
            authVersion: { increment: 1 },
            ...(lockedCustomer.passwordHash == null && profile?.passwordHash
              ? { passwordHash: profile.passwordHash }
              : {}),
          },
        });
      });

      await createCustomerSession(
        linkedCustomer.id,
        linkedCustomer.email,
        linkedCustomer.name,
      );
    } catch {
      return { ok: false, code: "conflict" };
    }
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
        gender: profile?.gender ?? null,
        birthDate: profile?.birthDate ? new Date(`${profile.birthDate}T00:00:00.000Z`) : null,
        address: profile?.address ?? null,
        province: profile?.province ?? null,
        district: profile?.district ?? null,
        postalCode: profile?.postalCode ?? null,
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
