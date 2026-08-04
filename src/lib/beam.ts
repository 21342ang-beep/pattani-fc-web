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
