import "server-only";

const XENDIT_API_VERSION = "2024-11-11";
const XENDIT_BASE_URL = "https://api.xendit.co";

export function xenditLegacyPaymentsEnabled(): boolean {
  return process.env.ENABLE_XENDIT_LEGACY_PAYMENTS === "true";
}

type XenditAction = {
  type?: string;
  descriptor?: string;
  value?: string;
};

export type XenditPaymentRequest = {
  payment_request_id?: string;
  reference_id?: string;
  actions?: XenditAction[];
};

function authorizationHeader() {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) throw new Error("Xendit ยังไม่ได้ตั้งค่า Secret Key");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export async function createPromptPayPaymentRequest(input: {
  referenceId: string;
  amountBaht: number;
  description: string;
}) {
  const response = await fetch(`${XENDIT_BASE_URL}/v3/payment_requests`, {
    method: "POST",
    headers: {
      Authorization: authorizationHeader(),
      "api-version": XENDIT_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference_id: input.referenceId,
      type: "PAY",
      country: "TH",
      currency: "THB",
      request_amount: input.amountBaht,
      capture_method: "AUTOMATIC",
      channel_code: "PROMPTPAY",
      description: input.description,
      metadata: { source: "pattani-fc-ticketing" },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const body = (await response.json().catch(() => null)) as XenditPaymentRequest | null;
  if (!response.ok || !body?.payment_request_id) {
    console.error("Xendit create payment request failed", response.status, body);
    throw new Error("ไม่สามารถสร้างรายการชำระเงินกับ Xendit ได้");
  }

  const qrString = body.actions?.find(
    (action) => action.type === "PRESENT_TO_CUSTOMER" && action.descriptor === "QR_STRING"
  )?.value;
  if (!qrString) {
    console.error("Xendit PromptPay response has no QR_STRING", body);
    throw new Error("Xendit ไม่ได้ส่ง QR Code สำหรับรายการนี้");
  }

  return { paymentRequestId: body.payment_request_id, qrString };
}
