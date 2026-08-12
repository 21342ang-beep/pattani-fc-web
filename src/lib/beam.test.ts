import assert from "node:assert/strict";
import { test } from "node:test";
import { createBeamPromptPayCharge, listAllBeamTransactions } from "./beam";

test("creates an idempotent Beam QR PromptPay charge", async () => {
  const originalFetch = globalThis.fetch;
  const originalMerchantId = process.env.BEAM_MERCHANT_ID;
  const originalApiKey = process.env.BEAM_API_KEY;
  process.env.BEAM_MERCHANT_ID = "merchant-test";
  process.env.BEAM_API_KEY = "api-key-test";

  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return Response.json({
      actionRequired: "ENCODED_IMAGE",
      chargeId: "ch_test",
      paymentMethodType: "QR_PROMPT_PAY",
      encodedImage: {
        expiry: "2030-01-01T00:15:00.000Z",
        imageBase64Encoded: "aW1hZ2U=",
        rawData: "qr-data",
      },
    });
  };

  try {
    const result = await createBeamPromptPayCharge({
      referenceId: "booking_test_12345678",
      amount: 15000,
      returnUrl: "https://pattanifc.co/tickets/test",
      expiryTime: new Date("2030-01-01T00:15:00.000Z"),
      idempotencyKey: "idem-test",
    });

    assert.equal(result.chargeId, "ch_test");
    assert.equal(result.qrImageBase64, "aW1hZ2U=");
    assert.equal(request?.url, "https://api.beamcheckout.com/api/v1/charges");
    const headers = request?.init?.headers as Record<string, string>;
    assert.equal(headers["x-beam-idempotency-key"], "idem-test");
    assert.equal(headers.Authorization, `Basic ${Buffer.from("merchant-test:api-key-test").toString("base64")}`);
    const body = JSON.parse(String(request?.init?.body));
    assert.equal(body.amount, 15000);
    assert.equal(body.paymentMethod.paymentMethodType, "QR_PROMPT_PAY");
    assert.equal(body.referenceId, "booking_test_12345678");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMerchantId === undefined) delete process.env.BEAM_MERCHANT_ID;
    else process.env.BEAM_MERCHANT_ID = originalMerchantId;
    if (originalApiKey === undefined) delete process.env.BEAM_API_KEY;
    else process.env.BEAM_API_KEY = originalApiKey;
  }
});

test("loads and normalizes every Beam transaction page", async () => {
  const originalFetch = globalThis.fetch;
  const originalMerchantId = process.env.BEAM_MERCHANT_ID;
  const originalApiKey = process.env.BEAM_API_KEY;
  process.env.BEAM_MERCHANT_ID = "merchant-test";
  process.env.BEAM_API_KEY = "api-key-test";
  const offsets: number[] = [];

  globalThis.fetch = async (url, init) => {
    const requestUrl = new URL(String(url));
    const offset = Number(requestUrl.searchParams.get("offset"));
    offsets.push(offset);
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Basic ${Buffer.from("merchant-test:api-key-test").toString("base64")}`);
    return Response.json({
      totalCount: 205,
      data: [{
        transactionId: `tx_${offset}`,
        sourceId: `ch_${offset}`,
        merchantId: "merchant-test",
        referenceId: `booking_code${offset}abcd_12345678`,
        chargeSource: "CHARGE",
        transactionType: offset === 200 ? "REFUND" : "PAYMENT",
        currency: "THB",
        grossAmount: 15_000,
        feeStrategy: "SUBTRACT_FROM_PAYOUT",
        feeAmount: 300,
        vatAmount: 21,
        netAmount: 14_679,
        transactionTime: "2030-01-01T00:00:00Z",
        createdAt: "2030-01-01T00:00:01Z",
      }],
    });
  };

  try {
    const result = await listAllBeamTransactions();
    assert.deepEqual(offsets, [0, 100, 200]);
    assert.equal(result.totalCount, 205);
    assert.equal(result.truncated, false);
    assert.equal(result.transactions.length, 3);
    assert.deepEqual(result.transactions[0], {
      transactionId: "tx_0",
      sourceId: "ch_0",
      referenceId: "booking_code0abcd_12345678",
      chargeSource: "CHARGE",
      transactionType: "PAYMENT",
      currency: "THB",
      grossAmount: 15_000,
      feeStrategy: "SUBTRACT_FROM_PAYOUT",
      feeAmount: 300,
      vatAmount: 21,
      netAmount: 14_679,
      transactionTime: "2030-01-01T00:00:00Z",
      createdAt: "2030-01-01T00:00:01Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMerchantId === undefined) delete process.env.BEAM_MERCHANT_ID;
    else process.env.BEAM_MERCHANT_ID = originalMerchantId;
    if (originalApiKey === undefined) delete process.env.BEAM_API_KEY;
    else process.env.BEAM_API_KEY = originalApiKey;
  }
});
