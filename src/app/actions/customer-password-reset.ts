"use server";

import { randomBytes, randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { findPasswordResetCustomerId } from "@/lib/customer-phone-ownership";
import {
  PASSWORD_RECOVERY_PROVIDER_TIMEOUT_MS,
  passwordResetPersistedChallenge,
  passwordResetShouldRequestProvider,
  passwordResetCommitAllowed,
  passwordRecoveryResponseTargetMs,
  remainingRecoveryResponseDelayMs,
} from "@/lib/customer-registration-policy";

const COOKIE = "customer_password_reset";
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const phoneSchema = z.string().trim().regex(/^[0-9+\-\s()]{9,20}$/);
const passwordSchema = z.string().min(8).max(200).regex(/[A-Za-z]/).regex(/[0-9]/);
const RESET_REQUEST_ERROR =
  "ไม่สามารถเริ่มการรีเซ็ตรหัสผ่านได้ กรุณาลองใหม่ภายหลัง";
const RESET_OTP_ERROR =
  "OTP ไม่ถูกต้อง หมดอายุ หรือคำขอถูกใช้งานแล้ว กรุณาขอรหัสใหม่";

export type PasswordResetState =
  | { error?: string; requested?: true; reset?: true }
  | undefined;

function credentials() {
  const key = process.env.THAIBULKSMS_OTP_KEY?.trim();
  const secret = process.env.THAIBULKSMS_OTP_SECRET?.trim();
  return key && secret ? { key, secret } : null;
}

function timingTargetMs(): number {
  return passwordRecoveryResponseTargetMs(randomInt(0, 1_000_000) / 1_000_000);
}

async function waitForRecoveryTiming(input: {
  startedAtMs: number;
  targetMs: number;
}): Promise<void> {
  const remainingMs = remainingRecoveryResponseDelayMs({
    startedAtMs: input.startedAtMs,
    nowMs: Date.now(),
    targetMs: input.targetMs,
  });
  if (remainingMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remainingMs));
  }
}

async function finishPasswordResetRequest(input: {
  challengeId: string;
  expiresAt: Date;
  startedAtMs: number;
  targetMs: number;
}): Promise<PasswordResetState> {
  (await cookies()).set(COOKIE, input.challengeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/member",
    expires: input.expiresAt,
  });
  await waitForRecoveryTiming(input);
  return { requested: true };
}

async function finishPasswordResetVerification(input: {
  state: PasswordResetState;
  startedAtMs: number;
  targetMs: number;
}): Promise<PasswordResetState> {
  await waitForRecoveryTiming(input);
  return input.state;
}

async function callOtpProvider(
  path: "/v2/otp/request" | "/v2/otp/verify",
  values: Record<string, string>,
): Promise<{ response: Response; data: { status?: string; token?: string } | null }> {
  const response = await fetch(`https://otp.thaibulksms.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
    cache: "no-store",
    signal: AbortSignal.timeout(PASSWORD_RECOVERY_PROVIDER_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => null)) as {
    status?: string;
    token?: string;
  } | null;
  return { response, data };
}

export async function requestCustomerPasswordReset(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const startedAtMs = Date.now();
  const targetMs = timingTargetMs();
  const rl = await rateLimit("customer_password_reset_request", {
    max: 3,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    return {
      error: "ส่งรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
    };
  }
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) {
    return { error: "กรุณากรอกเบอร์มือถือที่ใช้สมัคร" };
  }
  const phone = parsed.data.replace(/\D/g, "").replace(/^66(?=\d{9}$)/, "0");
  if (!/^0[689]\d{8}$/.test(phone)) {
    return { error: "กรุณากรอกเบอร์มือถือไทย 10 หลัก" };
  }
  const phoneLimit = await rateLimit("customer_password_reset_phone", {
    max: 3,
    windowMs: 30 * 60_000,
    ip: phone,
  });
  if (!phoneLimit.ok) {
    return { error: "ส่งรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง" };
  }
  const auth = credentials();
  if (!auth) return { error: "ระบบ OTP ยังไม่พร้อมใช้งาน" };

  // Every syntactically valid request gets one persisted, opaque challenge.
  // Unknown/unverified phones and provider failures get a NULL owner plus a
  // random provider token, so step 2 follows the same DB/network/timing path
  // but can never change a Customer or send an SMS to a non-owner.
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const ownerCustomerId = await findPasswordResetCustomerId(phone);
  const decoyProviderToken = randomBytes(32).toString("base64url");
  let issuedProviderToken: string | null = null;

  if (passwordResetShouldRequestProvider(ownerCustomerId)) {
    try {
      const { response, data } = await callOtpProvider("/v2/otp/request", {
        key: auth.key,
        secret: auth.secret,
        msisdn: phone,
      });
      if (
        response.ok &&
        data?.status === "success" &&
        data.token &&
        data.token.length <= 4096
      ) {
        issuedProviderToken = data.token;
      } else {
        console.error("Password-reset OTP provider rejected request", {
          status: response.status,
        });
      }
    } catch {
      console.error("Password-reset OTP provider unavailable");
    }
  }
  const {
    customerId: challengeCustomerId,
    providerToken,
  } = passwordResetPersistedChallenge({
    ownerCustomerId,
    issuedProviderToken,
    decoyProviderToken,
  });

  try {
    await prisma.$transaction(async (tx) => {
      if (challengeCustomerId) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${`customer-password-reset:${challengeCustomerId}`})
          )
        `;
        await tx.customerPasswordResetOtp.deleteMany({
          where: { customerId: challengeCustomerId },
        });
      }
      await tx.customerPasswordResetOtp.create({
        data: {
          id,
          customerId: challengeCustomerId,
          providerToken,
          expiresAt,
        },
      });
    });
  } catch (error) {
    console.error("Password-reset challenge persistence failed", {
      code:
        typeof error === "object" && error && "code" in error
          ? String(error.code).slice(0, 80)
          : "unknown",
    });
    await waitForRecoveryTiming({ startedAtMs, targetMs });
    return { error: RESET_REQUEST_ERROR };
  }

  return finishPasswordResetRequest({
    challengeId: id,
    expiresAt,
    startedAtMs,
    targetMs,
  });
}

export async function resetCustomerPassword(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const pin = String(formData.get("pin") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!/^\d{4,8}$/.test(pin)) return { error: "กรุณากรอกรหัส OTP" };
  if (!passwordSchema.safeParse(password).success) {
    return {
      error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัว และมีตัวอักษรกับตัวเลข",
    };
  }
  if (password !== confirmPassword) {
    return { error: "ยืนยันรหัสผ่านไม่ตรงกัน" };
  }

  const startedAtMs = Date.now();
  const targetMs = timingTargetMs();
  const finishGeneric = () =>
    finishPasswordResetVerification({
      state: { error: RESET_OTP_ERROR },
      startedAtMs,
      targetMs,
    });
  const ipLimit = await rateLimit("customer_password_reset_verify", {
    max: 8,
    windowMs: 15 * 60_000,
  });
  if (!ipLimit.ok) return finishGeneric();

  const id = (await cookies()).get(COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return finishGeneric();

  let rows: {
    id: string;
    customerId: string | null;
    providerToken: string;
  }[];
  try {
    rows = await prisma.$queryRaw<
      { id: string; customerId: string | null; providerToken: string }[]
    >`
      UPDATE "CustomerPasswordResetOtp"
      SET "attempts" = "attempts" + 1
      WHERE "id" = ${id}
        AND "expiresAt" > NOW()
        AND "attempts" < ${MAX_ATTEMPTS}
      RETURNING "id", "customerId", "providerToken"
    `;
  } catch {
    return finishGeneric();
  }
  const record = rows[0];
  if (!record || record.providerToken.length > 4096) return finishGeneric();

  const auth = credentials();
  if (!auth) return finishGeneric();
  try {
    const { response, data } = await callOtpProvider("/v2/otp/verify", {
      key: auth.key,
      secret: auth.secret,
      token: record.providerToken,
      pin,
    });
    if (!response.ok || data?.status !== "success") return finishGeneric();

    const passwordHash = await bcrypt.hash(password, 12);
    const committed = await prisma.$transaction(async (tx) => {
      // Verification occurs outside the transaction. Re-lock the exact local
      // challenge before changing credentials; a concurrent success deletes it.
      const locked = await tx.$queryRaw<
        { id: string; customerId: string | null }[]
      >`
        SELECT "id", "customerId" FROM "CustomerPasswordResetOtp"
        WHERE "id" = ${record.id}
          AND "expiresAt" > NOW()
        FOR UPDATE
      `;
      const challenge = locked[0];
      if (
        !passwordResetCommitAllowed({
          challengeStillPresent: Boolean(challenge),
          challengeCustomerId: challenge?.customerId ?? null,
          expectedCustomerId: record.customerId,
        })
      ) {
        if (challenge) {
          await tx.customerPasswordResetOtp.delete({
            where: { id: challenge.id },
          });
        }
        return false;
      }
      const customerId = record.customerId;
      if (!customerId) return false;
      await tx.customer.update({
        where: { id: customerId },
        data: {
          passwordHash,
          authVersion: { increment: 1 },
        },
      });
      await tx.customerPasswordResetOtp.deleteMany({
        where: { customerId },
      });
      return true;
    });
    if (!committed) return finishGeneric();
    (await cookies()).delete(COOKIE);
    return finishPasswordResetVerification({
      state: { reset: true },
      startedAtMs,
      targetMs,
    });
  } catch {
    return finishGeneric();
  }
}
