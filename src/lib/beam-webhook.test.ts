import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBeamPaymentReference, verifyBeamSignature } from "./beam-webhook";

test("verifies Beam's published HMAC example against the exact raw body", () => {
  const rawBody = Buffer.from(
    '{"chargeId":"ch_30GtUweMWec7r2hHIsV5xxQeJKp","merchantId":"m_2sHxsByPwESKYM4nMwdEBdhubPS","referenceId":"order#10001","status":"SUCCEEDED","currency":"THB","amount":3000000,"source":"PAYMENT_LINK","sourceId":"57Iot6c11o","transactionTime":"2025-07-23T10:16:12Z","paymentMethod":{"paymentMethodType":"CARD","card":{"last4":"1111","brand":"VISA"},"cardInstallments":null,"cardNetworkToken":null,"qrPromptPay":null,"alipay":null,"weChatPay":null,"trueMoney":null,"linePay":null,"shopeePay":null,"bangkokBankApp":null,"kPlus":null,"scbEasy":null,"krungsriApp":null},"failureCode":"","customer":{"primaryPhone":{"countryCode":"+66","number":"0958051075"},"email":"","deliveryAddress":{"contactName":"","phone":{"countryCode":"","number":""},"address":{"streetAddress":"","city":"","country":"","postCode":""}}},"createdAt":"2025-07-23T10:15:56.102401Z","updatedAt":"2025-07-23T10:16:17.418991Z"}',
  );

  assert.equal(
    verifyBeamSignature(
      rawBody,
      "1XzWtJHZ9Y1tmjkA/XZUIn1ZHrUQp1d0Ms0oDQfJBto=",
      "KOFELguf5L1ltuDlkDHGUkPPnQhrgYYijTR4Fqh7APc=",
    ),
    true,
  );
  assert.equal(
    verifyBeamSignature(Buffer.concat([rawBody, Buffer.from("\n")]), "1XzWtJHZ9Y1tmjkA/XZUIn1ZHrUQp1d0Ms0oDQfJBto=", "KOFELguf5L1ltuDlkDHGUkPPnQhrgYYijTR4Fqh7APc="),
    false,
  );
});

test("parses only Pattani FC payment references", () => {
  assert.deepEqual(parseBeamPaymentReference("booking_cm12345678_0123456789abcdef"), {
    kind: "booking",
    code: "cm12345678",
  });
  assert.deepEqual(parseBeamPaymentReference("season_PFC-2026-0001"), {
    kind: "season",
    code: "PFC-2026-0001",
  });
  assert.equal(parseBeamPaymentReference("order#10001"), null);
});
