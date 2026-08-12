import "server-only";

const BEAM_API_URL = "https://api.beamcheckout.com/api/v1";

type BeamEncodedImage = {
  expiry?: string;
  imageBase64Encoded?: string;
  rawData?: string;
};

type CreateChargeResponse = {
  actionRequired?: string;
  chargeId?: string;
  paymentMethodType?: string;
  encodedImage?: BeamEncodedImage;
  error?: { errorCode?: string };
};

export type BeamTransaction = {
  transactionId: string;
  sourceId: string;
  referenceId: string;
  chargeSource: string;
  transactionType: "PAYMENT" | "VOID" | "REFUND" | string;
  currency: string;
  grossAmount: number;
  feeStrategy: string;
  feeAmount: number;
  vatAmount: number;
  netAmount: number;
  transactionTime: string;
  createdAt: string;
};

type BeamTransactionListResponse = {
  data?: unknown;
  totalCount?: unknown;
  error?: { errorCode?: string };
};

export class BeamApiError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "BeamApiError";
  }
}

function authorizationHeader() {
  const merchantId = process.env.BEAM_MERCHANT_ID;
  const apiKey = process.env.BEAM_API_KEY;
  if (!merchantId || !apiKey) throw new BeamApiError("Beam API ยังไม่ได้ตั้งค่า", false);
  return `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function amountField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseTransaction(value: unknown): BeamTransaction | null {
  if (!isRecord(value)) return null;
  const transactionId = textField(value.transactionId);
  const referenceId = textField(value.referenceId);
  if (!transactionId || !referenceId) return null;

  return {
    transactionId,
    sourceId: textField(value.sourceId),
    referenceId,
    chargeSource: textField(value.chargeSource),
    transactionType: textField(value.transactionType),
    currency: textField(value.currency) || "THB",
    grossAmount: amountField(value.grossAmount),
    feeStrategy: textField(value.feeStrategy),
    feeAmount: amountField(value.feeAmount),
    vatAmount: amountField(value.vatAmount),
    netAmount: amountField(value.netAmount),
    transactionTime: textField(value.transactionTime),
    createdAt: textField(value.createdAt),
  };
}

export async function listBeamTransactions(input: {
  offset?: number;
  limit?: number;
  referenceId?: string;
} = {}) {
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 100)));
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (input.referenceId) query.set("referenceId", input.referenceId);

  let response: Response;
  try {
    response = await fetch(`${BEAM_API_URL}/transactions?${query}`, {
      headers: { Authorization: authorizationHeader() },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof BeamApiError) throw error;
    throw new BeamApiError("ไม่สามารถเชื่อมต่อข้อมูลธุรกรรม Beam ได้", true);
  }

  const body = (await response.json().catch(() => null)) as BeamTransactionListResponse | null;
  if (!response.ok) {
    console.error("Beam transaction listing failed", {
      status: response.status,
      errorCode: body?.error?.errorCode ?? "UNKNOWN",
    });
    throw new BeamApiError("ไม่สามารถดึงข้อมูลธุรกรรมจาก Beam ได้", response.status === 429 || response.status >= 500);
  }

  const transactions = Array.isArray(body?.data)
    ? body.data.map(parseTransaction).filter((item): item is BeamTransaction => item !== null)
    : [];
  const totalCount = typeof body?.totalCount === "number" && Number.isFinite(body.totalCount)
    ? Math.max(0, Math.trunc(body.totalCount))
    : transactions.length;

  return { transactions, totalCount };
}

export async function listAllBeamTransactions(maxTransactions = 2_000) {
  const limit = 100;
  const first = await listBeamTransactions({ limit });
  const fetchCount = Math.min(first.totalCount, Math.max(limit, maxTransactions));
  const offsets = Array.from(
    { length: Math.max(0, Math.ceil(fetchCount / limit) - 1) },
    (_, index) => (index + 1) * limit,
  );
  const transactions = [...first.transactions];

  // Limit concurrency so opening an admin page cannot burst the Beam API.
  for (let index = 0; index < offsets.length; index += 4) {
    const batch = await Promise.all(
      offsets.slice(index, index + 4).map((offset) => listBeamTransactions({ offset, limit })),
    );
    for (const page of batch) transactions.push(...page.transactions);
  }

  return {
    transactions,
    totalCount: first.totalCount,
    truncated: first.totalCount > maxTransactions,
  };
}

export async function createBeamPromptPayCharge(input: {
  referenceId: string;
  amount: number;
  returnUrl: string;
  expiryTime: Date;
  idempotencyKey: string;
}) {
  let response: Response;
  try {
    response = await fetch(`${BEAM_API_URL}/charges`, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type": "application/json",
        "x-beam-idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: "THB",
        paymentMethod: {
          paymentMethodType: "QR_PROMPT_PAY",
          qrPromptPay: { expiryTime: input.expiryTime.toISOString() },
        },
        referenceId: input.referenceId,
        returnUrl: input.returnUrl,
        skip3dsFlow: false,
      }),
      cache: "no-store",
    });
  } catch {
    throw new BeamApiError("ไม่สามารถเชื่อมต่อระบบชำระเงิน Beam ได้", true);
  }

  const body = (await response.json().catch(() => null)) as CreateChargeResponse | null;
  if (!response.ok) {
    console.error("Beam charge creation failed", {
      status: response.status,
      errorCode: body?.error?.errorCode ?? "UNKNOWN",
    });
    throw new BeamApiError("ไม่สามารถสร้าง QR ชำระเงินได้ กรุณาลองใหม่", response.status === 429 || response.status >= 500);
  }

  const encoded = body?.encodedImage;
  if (
    body?.actionRequired !== "ENCODED_IMAGE" ||
    body.paymentMethodType !== "QR_PROMPT_PAY" ||
    !body.chargeId ||
    !encoded?.imageBase64Encoded ||
    !encoded.expiry
  ) {
    console.error("Beam QR charge returned an unexpected response", {
      actionRequired: body?.actionRequired,
      paymentMethodType: body?.paymentMethodType,
      hasChargeId: Boolean(body?.chargeId),
      hasImage: Boolean(encoded?.imageBase64Encoded),
    });
    throw new BeamApiError("Beam ไม่ได้ส่ง QR Code กลับมา", true);
  }

  const expiresAt = new Date(encoded.expiry);
  if (Number.isNaN(expiresAt.getTime())) throw new BeamApiError("วันหมดอายุ QR จาก Beam ไม่ถูกต้อง", true);

  return {
    chargeId: body.chargeId,
    qrImageBase64: encoded.imageBase64Encoded,
    expiresAt,
  };
}
