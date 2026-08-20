import assert from "node:assert/strict";
import test from "node:test";
import { decodeJwt } from "jose";
import {
  createSeasonPassBarcodeAccessToken,
  verifySeasonPassBarcodeAccessToken,
  type SeasonPassBarcodeAccessBinding,
} from "./season-pass-barcode-access";

const ORIGINAL_SECRET = process.env.SEASON_BARCODE_ACCESS_SECRET;
const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;
const bindingA: SeasonPassBarcodeAccessBinding = {
  barcodeId: "cmseasonbarcode0001",
  barcode: "PFC26-1500-0001",
  gateVersion: 0,
  gateNonce: "11111111-1111-4111-8111-111111111111",
  orderId: "cmseasonorder0001",
};

test.afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.SEASON_BARCODE_ACCESS_SECRET;
  } else {
    process.env.SEASON_BARCODE_ACCESS_SECRET = ORIGINAL_SECRET;
  }
  if (ORIGINAL_SESSION_SECRET === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
  }
  if (ORIGINAL_NODE_ENV === undefined) {
    delete mutableEnv.NODE_ENV;
  } else {
    mutableEnv.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

test("production requires a dedicated secret of at least 32 bytes", async () => {
  mutableEnv.NODE_ENV = "production";
  process.env.SESSION_SECRET = "s".repeat(32);
  delete process.env.SEASON_BARCODE_ACCESS_SECRET;
  await assert.rejects(
    createSeasonPassBarcodeAccessToken(bindingA),
    /SEASON_BARCODE_ACCESS_SECRET is required in production/,
  );

  process.env.SEASON_BARCODE_ACCESS_SECRET = "too-short";
  await assert.rejects(
    createSeasonPassBarcodeAccessToken(bindingA),
    /at least 32 bytes/,
  );
});

test("development derives a domain-separated key from SESSION_SECRET", async () => {
  mutableEnv.NODE_ENV = "development";
  delete process.env.SEASON_BARCODE_ACCESS_SECRET;
  process.env.SESSION_SECRET = "a".repeat(32);
  const token = await createSeasonPassBarcodeAccessToken(bindingA);
  assert.equal(
    await verifySeasonPassBarcodeAccessToken(token, bindingA),
    true,
  );

  process.env.SESSION_SECRET = "b".repeat(32);
  assert.equal(
    await verifySeasonPassBarcodeAccessToken(token, bindingA),
    false,
  );
});

test("render access is bound to the exact current assignment", async () => {
  mutableEnv.NODE_ENV = "test";
  process.env.SEASON_BARCODE_ACCESS_SECRET = "a".repeat(32);
  const token = await createSeasonPassBarcodeAccessToken(bindingA);
  const decoded = decodeJwt(token);
  assert.equal("gateNonce" in decoded, false);
  assert.equal("gateVersion" in decoded, false);
  assert.equal("barcodeId" in decoded, false);
  assert.equal("barcode" in decoded, false);
  assert.equal("orderId" in decoded, false);
  assert.equal(JSON.stringify(decoded).includes(bindingA.gateNonce), false);
  assert.equal(typeof decoded.assignment, "string");
  assert.equal(
    await verifySeasonPassBarcodeAccessToken(token, bindingA),
    true,
  );
  assert.equal(
    await verifySeasonPassBarcodeAccessToken(token, {
      ...bindingA,
      orderId: "cmseasonorder0002",
      gateVersion: 1,
      gateNonce: "22222222-2222-4222-8222-222222222222",
    }),
    false,
  );

  process.env.SEASON_BARCODE_ACCESS_SECRET = "b".repeat(32);
  assert.equal(
    await verifySeasonPassBarcodeAccessToken(token, bindingA),
    false,
  );
});
