"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createCustomerSession,
  deleteCustomerSession,
} from "@/lib/customer-session";
import { clearBookingAccessCookies } from "@/lib/booking-access-cookies";
import { rateLimit } from "@/lib/rate-limit";
import { getPhoneOwnerIds } from "@/lib/customer-phone-ownership";
import { createOAuthState, getSafeReturnTo } from "@/lib/oauth";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/oauth-google";
import { buildLineAuthUrl, isLineConfigured } from "@/lib/oauth-line";
import { verifyRegistrationTurnstile } from "@/lib/turnstile";
import {
  CUSTOMER_REGISTRATION_MAX_OTP_ATTEMPTS,
  CUSTOMER_REGISTRATION_OTP_TTL_MS,
  normalizeRegistrationPhone,
  passwordRegistrationSecurityPlan,
  registrationChallengeActivationEligible,
  resolveRegistrationAccountEmail,
} from "@/lib/customer-registration-policy";

const REGISTRATION_COOKIE = "customer_registration";
const REGISTRATION_GENERIC_ERROR =
  "ไม่สามารถเริ่มการสมัครสมาชิกได้ กรุณาตรวจสอบข้อมูลหรือลองใหม่ภายหลัง";
const REGISTRATION_OTP_GENERIC_ERROR =
  "รหัส OTP ไม่ถูกต้อง หมดอายุ หรือคำขอถูกใช้งานแล้ว กรุณาขอรหัสใหม่";

const registerSchema = z.object({
  name: z.string().trim().min(2, "กรอกชื่อ-นามสกุลให้ครบ").max(100),
  email: z.preprocess(
    (value) =>
      value == null
        ? ""
        : typeof value === "string"
          ? value.trim().toLowerCase()
          : value,
    z
      .literal("")
      .or(
        z
          .string()
          .email("อีเมลไม่ถูกต้อง")
          .max(200, "อีเมลยาวเกินไป"),
      ),
  ),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{9,15}$/, "เบอร์โทรไม่ถูกต้อง"),
  gender: z.enum(["MALE", "FEMALE"], {
    message: "กรุณาเลือกเพศ",
  }),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันเกิด")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date <= new Date();
    }, "วันเกิดไม่ถูกต้อง"),
  // รองรับเลขที่บ้านสั้น เช่น 73/1 หรือ 1/1
  address: z.string().trim().min(3, "กรุณากรอกที่อยู่").max(500),
  province: z.string().trim().min(1, "กรุณาเลือกจังหวัด").max(100),
  district: z.string().trim().min(1, "กรุณาเลือกอำเภอ/เขต").max(100),
  postalCode: z.string().regex(/^\d{5}$/, "กรุณาเลือกรหัสไปรษณีย์"),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร")
    .max(200, "รหัสผ่านยาวเกินไป")
    .regex(/\S/, "รหัสผ่านต้องไม่เป็นช่องว่างทั้งหมด"),
  confirmPassword: z.string(),
  pdpaConsent: z.literal("on", {
    message: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร",
  }),
  phoneVerification: z.enum(["skip", "otp"]).default("skip"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "รหัสผ่านยืนยันไม่ตรงกัน",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  // อีเมล หรือเบอร์โทรศัพท์ที่ใช้สมัคร
  identifier: z.string().trim().min(1, "กรุณากรอกอีเมลหรือเบอร์โทรศัพท์").max(200),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200),
});

const registrationPinSchema = z.string().trim().regex(/^\d{4,8}$/);

function registrationOtpCredentials() {
  const key = process.env.THAIBULKSMS_OTP_KEY?.trim();
  const secret = process.env.THAIBULKSMS_OTP_SECRET?.trim();
  return key && secret ? { key, secret } : null;
}

function registrationProviderValue(data: unknown, key: string): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

async function registrationOtpProviderRequest(
  path: "/v2/otp/request" | "/v2/otp/verify",
  values: Record<string, string>,
) {
  const response = await fetch(`https://otp.thaibulksms.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data: unknown = await response.json().catch(() => null);
  return { response, data };
}

function maskedRegistrationPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{3})$/, "$1****$2");
}

export type CustomerAuthState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<string, string>>;
      redirectTo?: string;
      otpRequired?: true;
      maskedPhone?: string;
      reference?: string | null;
      registered?: true;
    }
  | undefined;

export async function registerCustomer(
  _prev: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  // กัน abuse: 5 ครั้ง / 10 นาที / IP
  const rl = await rateLimit("register", { max: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return {
      error: `สมัครสมาชิกบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  // mode = ปุ่มที่ลูกค้ากด: "password" (สมัครด้วยรหัสผ่าน) | "google" | "line"
  // ทุกโหมด validate ฟอร์มเต็มเหมือนกัน (บัญชี hybrid = มีรหัสผ่านเสมอ)
  const mode = String(formData.get("mode") ?? "password");
  const returnTo = getSafeReturnTo(formData.get("returnTo")?.toString());

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    gender: formData.get("gender"),
    birthDate: formData.get("birthDate"),
    address: formData.get("address"),
    province: formData.get("province"),
    district: formData.get("district"),
    postalCode: formData.get("postalCode"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    pdpaConsent: formData.get("pdpaConsent"),
    phoneVerification: formData.get("phoneVerification") || "skip",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors };
  }

  const humanVerified = await verifyRegistrationTurnstile(
    formData.get("turnstileToken"),
  );
  if (!humanVerified) {
    return {
      error: "ไม่ผ่านการตรวจสอบความปลอดภัย กรุณาลองใหม่อีกครั้ง",
    };
  }

  const {
    name,
    email,
    phone,
    gender,
    birthDate,
    address,
    province,
    district,
    postalCode,
    password,
    phoneVerification,
  } = parsed.data;
  const accountEmail = resolveRegistrationAccountEmail(
    email,
    randomBytes(32).toString("hex"),
  );

  // ── โหมดผูก Google / LINE ──
  // validate ครบแล้ว → hash รหัสผ่าน, ฝากข้อมูลไว้ใน OAuth state (signed cookie),
  // แล้ว redirect ไป provider. บัญชีจะถูกสร้างตอน callback (ยึดอีเมล verified ของ provider)
  if (mode === "google" || mode === "line") {
    const provider = mode === "google" ? "GOOGLE" : "LINE";
    const configured =
      provider === "GOOGLE" ? isGoogleConfigured() : isLineConfigured();
    if (!configured) {
      return {
        error:
          provider === "GOOGLE"
            ? "ยังไม่ได้เปิดใช้การผูกบัญชี Google กรุณาสมัครด้วยรหัสผ่านก่อน"
            : "ยังไม่ได้เปิดใช้การผูกบัญชี LINE กรุณาสมัครด้วยรหัสผ่านก่อน",
      };
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const nonce = await createOAuthState(provider, "register", true, {
      name,
      email: email || "",
      phone: phone || null,
      gender,
      birthDate,
      address,
      province,
      district,
      postalCode,
      passwordHash,
    }, returnTo);
    const authUrl =
      provider === "GOOGLE"
        ? buildGoogleAuthUrl(nonce)
        : buildLineAuthUrl(nonce, nonce);
    redirect(authUrl); // absolute/external URL — server action ตอบ 303
  }

  // ── โหมดสมัครด้วยรหัสผ่าน ──
  // OTP is optional. Skipping creates an unverified account immediately;
  // requesting OTP keeps the data pending until provider verification.
  const normalizedPhone = normalizeRegistrationPhone(phone);
  if (!normalizedPhone) {
    return {
      error: "กรุณาตรวจสอบข้อมูล",
      fieldErrors: { phone: "กรุณากรอกเบอร์มือถือไทย 10 หลัก" },
    };
  }
  const phoneLimit = await rateLimit("customer_registration_phone", {
    max: 3,
    windowMs: 15 * 60_000,
    ip: normalizedPhone,
  });
  if (!phoneLimit.ok) return { error: REGISTRATION_GENERIC_ERROR };

  // Hash before ownership lookups so duplicate/non-duplicate responses do not
  // differ by one expensive bcrypt operation.
  const passwordHash = await bcrypt.hash(password, 12);
  const [existingEmail, phoneOwners] = await Promise.all([
    email
      ? prisma.customer.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        })
      : Promise.resolve(null),
    getPhoneOwnerIds(normalizedPhone),
  ]);
  const activationEligible = registrationChallengeActivationEligible({
    emailAlreadyRegistered: Boolean(existingEmail),
    phoneOwnerCount: phoneOwners.length,
  });

  if (phoneVerification === "skip") {
    const activationPlan = passwordRegistrationSecurityPlan({
      verificationRequested: false,
      challengeActive: false,
      activationEligible,
      otpVerified: false,
      verifiedAt: new Date(),
    });
    if (!activationPlan.createCustomer || !activationPlan.issueCustomerSession) {
      return { error: REGISTRATION_GENERIC_ERROR };
    }

    try {
      const customer = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-phone:${normalizedPhone}`}))`,
        );
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-email:${accountEmail.toLowerCase()}`}))`,
        );

        const [emailOwner, currentPhoneOwners] = await Promise.all([
          tx.customer.findFirst({
            where: { email: { equals: accountEmail, mode: "insensitive" } },
            select: { id: true },
          }),
          tx.$queryRaw<{ id: string }[]>(Prisma.sql`
            SELECT "id" FROM "Customer"
            WHERE (
              regexp_replace(coalesce("phone", ''), '\\D', '', 'g') = ${normalizedPhone}
              OR regexp_replace(coalesce("phone", ''), '\\D', '', 'g') = ${`66${normalizedPhone.slice(1)}`}
            )
            LIMIT 1
          `),
        ]);
        if (emailOwner || currentPhoneOwners.length > 0) return null;

        return tx.customer.create({
          data: {
            email: accountEmail,
            passwordHash,
            name,
            phone: normalizedPhone,
            phoneVerifiedAt: activationPlan.phoneVerifiedAt,
            gender,
            birthDate: new Date(`${birthDate}T00:00:00.000Z`),
            address,
            province,
            district,
            postalCode,
            pdpaConsentAt: new Date(),
            lastLoginAt: new Date(),
          },
          select: { id: true, email: true, name: true, authVersion: true },
        });
      });
      if (!customer) return { error: REGISTRATION_GENERIC_ERROR };

      try {
        await createCustomerSession(
          customer.id,
          customer.email,
          customer.name,
          customer.authVersion,
        );
        return { registered: true, redirectTo: returnTo ?? "/member" };
      } catch {
        return { registered: true, redirectTo: "/member/login?registered=1" };
      }
    } catch (error) {
      console.error("Unverified customer registration failed", {
        code:
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : "unknown",
      });
      return { error: REGISTRATION_GENERIC_ERROR };
    }
  }

  const credentials = registrationOtpCredentials();
  if (!credentials) return { error: "ระบบ OTP ยังไม่พร้อมใช้งาน" };

  // Never reveal whether either identifier already belongs to an account.
  // A duplicate follows the same provider + persisted challenge + OTP UI, but
  // the immutable eligibility bit prevents activation after proof succeeds.

  try {
    const { response, data } = await registrationOtpProviderRequest(
      "/v2/otp/request",
      {
        key: credentials.key,
        secret: credentials.secret,
        msisdn: normalizedPhone,
      },
    );
    const providerToken = registrationProviderValue(data, "token");
    if (
      !response.ok ||
      registrationProviderValue(data, "status") !== "success" ||
      !providerToken ||
      providerToken.length > 4096
    ) {
      console.error("Registration OTP provider rejected request", {
        status: response.status,
        code: registrationProviderValue(data, "code"),
      });
      return { error: REGISTRATION_GENERIC_ERROR };
    }

    const challengeId = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + CUSTOMER_REGISTRATION_OTP_TTL_MS);
    const reference = registrationProviderValue(data, "refno")?.slice(0, 100) ?? null;
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Bounded opportunistic cleanup keeps abandoned challenges from growing
      // indefinitely without turning one request into an unbounded delete.
      await tx.$executeRaw`
        WITH expired AS (
          SELECT "id" FROM "CustomerRegistrationChallenge"
          -- Prisma stores DateTime values in this timestamp-without-time-zone
          -- column as UTC wall time. Compare against UTC too, regardless of
          -- the PostgreSQL session timezone (production is Asia/Bangkok).
          WHERE "expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          ORDER BY "expiresAt" ASC
          LIMIT 100
        )
        DELETE FROM "CustomerRegistrationChallenge"
        WHERE "id" IN (SELECT "id" FROM expired)
      `;
      await tx.customerRegistrationChallenge.create({
        data: {
          id: challengeId,
          email: accountEmail,
          passwordHash,
          name,
          phone: normalizedPhone,
          gender,
          birthDate: new Date(`${birthDate}T00:00:00.000Z`),
          address,
          province,
          district,
          postalCode,
          pdpaConsentAt: now,
          providerToken,
          reference,
          returnTo,
          activationEligible,
          expiresAt,
        },
      });
    });
    (await cookies()).set(REGISTRATION_COOKIE, challengeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/register",
      expires: expiresAt,
    });
    return {
      otpRequired: true,
      maskedPhone: maskedRegistrationPhone(normalizedPhone),
      reference,
    };
  } catch (error) {
    console.error("Registration challenge could not be created", {
      code:
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "unknown",
    });
    return { error: REGISTRATION_GENERIC_ERROR };
  }
}

export async function verifyCustomerRegistrationOtp(
  _prev: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const ipLimit = await rateLimit("customer_registration_otp_verify", {
    max: 8,
    windowMs: 15 * 60_000,
  });
  if (!ipLimit.ok) return { error: REGISTRATION_OTP_GENERIC_ERROR };

  const parsedPin = registrationPinSchema.safeParse(formData.get("pin"));
  if (!parsedPin.success) return { error: REGISTRATION_OTP_GENERIC_ERROR };
  const credentials = registrationOtpCredentials();
  if (!credentials) return { error: "ระบบ OTP ยังไม่พร้อมใช้งาน" };

  const cookieStore = await cookies();
  const challengeId = cookieStore.get(REGISTRATION_COOKIE)?.value;
  if (!challengeId || !/^[A-Za-z0-9_-]{43}$/.test(challengeId)) {
    return { error: REGISTRATION_OTP_GENERIC_ERROR };
  }
  const challengeLimit = await rateLimit("customer_registration_otp_challenge", {
    max: CUSTOMER_REGISTRATION_MAX_OTP_ATTEMPTS,
    windowMs: CUSTOMER_REGISTRATION_OTP_TTL_MS,
    ip: challengeId,
  });
  if (!challengeLimit.ok) return { error: REGISTRATION_OTP_GENERIC_ERROR };

  let attempts: { id: string; phone: string; providerToken: string }[];
  try {
    attempts = await prisma.$queryRaw<{
      id: string;
      phone: string;
      providerToken: string;
    }[]>`
      UPDATE "CustomerRegistrationChallenge"
      SET "attempts" = "attempts" + 1
      WHERE "id" = ${challengeId}
        AND "expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        AND "completedAt" IS NULL
        AND "attempts" < ${CUSTOMER_REGISTRATION_MAX_OTP_ATTEMPTS}
      RETURNING "id", "phone", "providerToken"
    `;
  } catch {
    return { error: REGISTRATION_OTP_GENERIC_ERROR };
  }
  const attempt = attempts[0];
  if (!attempt) return { error: REGISTRATION_OTP_GENERIC_ERROR };

  const phoneLimit = await rateLimit("customer_registration_otp_phone_verify", {
    max: CUSTOMER_REGISTRATION_MAX_OTP_ATTEMPTS,
    windowMs: 15 * 60_000,
    ip: attempt.phone,
  });
  if (!phoneLimit.ok) return { error: REGISTRATION_OTP_GENERIC_ERROR };

  try {
    const { response, data } = await registrationOtpProviderRequest(
      "/v2/otp/verify",
      {
        key: credentials.key,
        secret: credentials.secret,
        token: attempt.providerToken,
        pin: parsedPin.data,
      },
    );
    const otpVerified =
      response.ok && registrationProviderValue(data, "status") === "success";
    if (!otpVerified) return { error: REGISTRATION_OTP_GENERIC_ERROR };

    const verifiedAt = new Date();
    const activated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-phone:${attempt.phone}`}))`,
      );
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "CustomerRegistrationChallenge"
        WHERE "id" = ${attempt.id}
          AND "expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          AND "completedAt" IS NULL
        FOR UPDATE
      `;
      if (!locked[0]) return null;
      const challenge = await tx.customerRegistrationChallenge.findUnique({
        where: { id: attempt.id },
      });
      if (!challenge) return null;
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-email:${challenge.email.toLowerCase()}`}))`,
      );

      const activationPlan = passwordRegistrationSecurityPlan({
        verificationRequested: true,
        challengeActive: true,
        activationEligible: challenge.activationEligible,
        otpVerified,
        verifiedAt,
      });
      if (
        !activationPlan.createCustomer ||
        !activationPlan.issueCustomerSession ||
        !activationPlan.trustPhoneForRecovery ||
        !activationPlan.phoneVerifiedAt
      ) {
        await tx.customerRegistrationChallenge.delete({
          where: { id: challenge.id },
        });
        return null;
      }

      const [emailOwner, phoneOwners] = await Promise.all([
        tx.customer.findFirst({
          where: { email: { equals: challenge.email, mode: "insensitive" } },
          select: { id: true },
        }),
        tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT "id" FROM "Customer"
          WHERE (
              regexp_replace(coalesce("phone", ''), '\\D', '', 'g') = ${challenge.phone}
              OR regexp_replace(coalesce("phone", ''), '\\D', '', 'g') = ${`66${challenge.phone.slice(1)}`}
            )
          LIMIT 1
        `),
      ]);
      if (emailOwner || phoneOwners.length > 0) {
        await tx.customerRegistrationChallenge.delete({
          where: { id: challenge.id },
        });
        return null;
      }

      const customer = await tx.customer.create({
        data: {
          email: challenge.email,
          passwordHash: challenge.passwordHash,
          name: challenge.name,
          phone: challenge.phone,
          phoneVerifiedAt: activationPlan.phoneVerifiedAt,
          gender: challenge.gender,
          birthDate: challenge.birthDate,
          address: challenge.address,
          province: challenge.province,
          district: challenge.district,
          postalCode: challenge.postalCode,
          pdpaConsentAt: challenge.pdpaConsentAt,
        },
        select: { id: true, email: true, name: true, authVersion: true },
      });
      await tx.customerRegistrationChallenge.delete({
        where: { id: challenge.id },
      });
      return {
        ...customer,
        returnTo: challenge.returnTo,
      };
    });
    cookieStore.delete(REGISTRATION_COOKIE);
    if (!activated) return { error: REGISTRATION_OTP_GENERIC_ERROR };
    try {
      await createCustomerSession(
        activated.id,
        activated.email,
        activated.name,
        activated.authVersion,
      );
      return {
        registered: true,
        redirectTo: activated.returnTo ?? "/member",
      };
    } catch {
      // Account + verified recovery phone are already safely activated. If
      // session issuance races a security change, require a normal login.
      return { registered: true, redirectTo: "/member/login?registered=1" };
    }
  } catch (error) {
    console.error("Registration OTP verification failed", {
      code:
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "unknown",
    });
    return { error: REGISTRATION_OTP_GENERIC_ERROR };
  }
}

export async function cancelCustomerRegistrationChallenge(): Promise<void> {
  const cookieStore = await cookies();
  const challengeId = cookieStore.get(REGISTRATION_COOKIE)?.value;
  if (challengeId && /^[A-Za-z0-9_-]{43}$/.test(challengeId)) {
    try {
      await prisma.customerRegistrationChallenge.deleteMany({
        where: { id: challengeId },
      });
    } catch (error) {
      console.error("Registration challenge cancellation cleanup failed", {
        code:
          typeof error === "object" && error && "code" in error
            ? String(error.code).slice(0, 80)
            : "unknown",
      });
    }
  }
  cookieStore.delete(REGISTRATION_COOKIE);
}

export async function loginCustomer(
  _prev: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  // กัน brute-force: 10 ครั้ง / 10 นาที / IP
  const rl = await rateLimit("customer_login", {
    max: 10,
    windowMs: 10 * 60_000,
  });
  if (!rl.ok) {
    return {
      error: `พยายามเข้าสู่ระบบบ่อยเกินไป ลองอีกครั้งใน ${rl.retryAfterSec} วินาที`,
    };
  }

  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "อีเมล/เบอร์โทรศัพท์ หรือรหัสผ่านไม่ถูกต้อง" };
  }

  const identifier = parsed.data.identifier;
  const loginIdentity = identifier.includes("@")
    ? identifier.trim().toLowerCase()
    : identifier.replace(/\D/g, "");
  const accountRl = await rateLimit("customer_login_account", {
    max: 10,
    windowMs: 30 * 60_000,
    ip: loginIdentity,
  });
  if (!accountRl.ok) {
    return {
      error: `พยายามเข้าสู่ระบบบ่อยเกินไป ลองอีกครั้งใน ${accountRl.retryAfterSec} วินาที`,
    };
  }
  let customer: Awaited<ReturnType<typeof prisma.customer.findUnique>> = null;
  if (identifier.includes("@")) {
    customer = await prisma.customer.findUnique({
      where: { email: identifier.toLowerCase() },
    });
  } else {
    // Password authentication may use an unverified phone as a username. OTP
    // remains required before trusting that phone for recovery or ticket data.
    // Never guess between duplicate legacy rows.
    const ownerIds = await getPhoneOwnerIds(identifier);
    if (ownerIds.length === 1) {
      customer = await prisma.customer.findUnique({
        where: { id: ownerIds[0] },
      });
    }
  }
  // เปรียบเทียบ password เสมอแม้ user ไม่มี เพื่อกัน timing attack
  const dummyHash = "$2b$12$QZJ/HRFVLd4HnZLjo8OBU.j8KD14Szu.WVM20ciuOHbEESySgkRN.";
  const ok = await bcrypt.compare(
    parsed.data.password,
    customer?.passwordHash ?? dummyHash,
  );

  if (!customer || !ok) {
    return { error: "อีเมล/เบอร์โทรศัพท์ หรือรหัสผ่านไม่ถูกต้อง" };
  }

  // บัญชี social-only ไม่มีรหัสผ่าน → แจ้งให้ใช้ social login
  if (!customer.passwordHash) {
    return {
      error: "บัญชีนี้เข้าสู่ระบบด้วย Google/LINE — กรุณากดปุ่ม social ด้านบน",
    };
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });
  await createCustomerSession(customer.id, customer.email, customer.name);
  // ล็อกอินจาก flow จองบัตรรายปี → เด้งกลับไปกรอกรายละเอียดการจองต่อ
  const returnTo = getSafeReturnTo(formData.get("returnTo")?.toString());
  redirect(returnTo ?? "/member");
}

export async function logoutCustomer(): Promise<void> {
  await deleteCustomerSession();
  await clearBookingAccessCookies();
  redirect("/");
}
