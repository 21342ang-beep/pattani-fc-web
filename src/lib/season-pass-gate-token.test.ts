import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import bwipjs from "bwip-js/node";
import { SEASON_PASS_BARCODE_WIDTH_MM } from "./season-pass-barcode-svg";

process.env.SESSION_SECRET ??= "test-only-session-secret-that-is-at-least-32-bytes";

let gateTokens: typeof import("./season-pass-gate-token");

before(async () => {
  gateTokens = await import("./season-pass-gate-token");
});

const assignmentA = {
  id: "cmseasonbarcode0001",
  barcode: "PFC26-2500-0041",
  gateVersion: 0,
  gateNonce: "11111111-1111-4111-8111-111111111111",
  legacyGateAllowed: false,
};

test("SPG2 authenticates the current barcode assignment state", () => {
  const token = gateTokens.createSeasonPassGateToken(assignmentA);
  assert.match(token, /^SPG2\.[A-Za-z0-9_-]{22}\.[0-9a-z]+$/);
  assert.ok(token.length <= 35);
  const credential = gateTokens.resolveSeasonPassGateCredential(token);
  assert.ok(credential);
  assert.equal(
    gateTokens.seasonPassGateCredentialMatchesRow(credential, assignmentA),
    true,
  );
});

test("saved token A is rejected after release and reassignment of the same human barcode to B", () => {
  const tokenA = gateTokens.createSeasonPassGateToken(assignmentA);
  const credentialA = gateTokens.resolveSeasonPassGateCredential(tokenA);
  assert.ok(credentialA);

  const assignmentB = {
    ...assignmentA,
    gateVersion: assignmentA.gateVersion + 1,
    gateNonce: "22222222-2222-4222-8222-222222222222",
  };
  assert.equal(
    gateTokens.seasonPassGateCredentialMatchesRow(credentialA, assignmentB),
    false,
  );

  const tokenB = gateTokens.createSeasonPassGateToken(assignmentB);
  const credentialB = gateTokens.resolveSeasonPassGateCredential(tokenB);
  assert.ok(credentialB);
  assert.equal(
    gateTokens.seasonPassGateCredentialMatchesRow(credentialB, assignmentB),
    true,
  );
});

test("SPG2 rejects malformed input and a changed random capability", () => {
  const token = gateTokens.createSeasonPassGateToken(assignmentA);
  const credential = gateTokens.resolveSeasonPassGateCredential(token);
  assert.ok(credential);

  const changedNonceRow = {
    ...assignmentA,
    gateNonce: "33333333-3333-4333-8333-333333333333",
  };
  assert.equal(
    gateTokens.seasonPassGateCredentialMatchesRow(credential, changedNonceRow),
    false,
  );

  const changedToken = gateTokens.createSeasonPassGateToken(changedNonceRow);
  const changedCredential = gateTokens.resolveSeasonPassGateCredential(changedToken);
  assert.ok(changedCredential);
  assert.equal(
    gateTokens.seasonPassGateCredentialMatchesRow(changedCredential, assignmentA),
    false,
  );
  assert.equal(
    gateTokens.resolveSeasonPassGateCredential(`${token}=`),
    null,
  );
});

test("random SPG2 capabilities decode canonically without collisions", () => {
  const tokens = new Set<string>();
  for (let index = 0; index < 100; index += 1) {
    const row = {
      ...assignmentA,
      gateVersion: index,
      gateNonce: randomUUID(),
    };
    const token = gateTokens.createSeasonPassGateToken(row);
    assert.equal(tokens.has(token), false);
    tokens.add(token);
    const credential = gateTokens.resolveSeasonPassGateCredential(token);
    assert.ok(credential);
    assert.equal(
      gateTokens.seasonPassGateCredentialMatchesRow(credential, row),
      true,
    );
  }
});

test("SPG2 Code128 keeps a scannable narrow bar at 53.8mm print width", () => {
  // Exercise the longest version value that can fit the PostgreSQL/Prisma Int
  // column so later credential rotations cannot silently make the bars thinner.
  const token = gateTokens.createSeasonPassGateToken({
    ...assignmentA,
    gateVersion: 2_147_483_647,
  });
  const svg = bwipjs.toSVG({
    bcid: "code128",
    text: token,
    scale: 2,
    height: 12,
    includetext: false,
  });
  const viewBoxWidth = Number(svg.match(/viewBox="0 0 (\d+) /)?.[1]);
  const strokeWidth = Number(svg.match(/stroke-width="(\d+)"/)?.[1]);
  assert.ok(Number.isFinite(viewBoxWidth) && viewBoxWidth > 0);
  assert.ok(Number.isFinite(strokeWidth) && strokeWidth > 0);
  const narrowBarMm =
    (SEASON_PASS_BARCODE_WIDTH_MM * strokeWidth) / viewBoxWidth;
  assert.ok(
    narrowBarMm >= 0.25,
    `expected a >=0.25mm narrow bar, received ${narrowBarMm.toFixed(3)}mm`,
  );
});

test("legacy SPG1/raw codes require both explicit transition and an eligible DB row", () => {
  const previousLegacy = process.env.SEASON_PASS_ACCEPT_LEGACY_GATE_CODES;
  delete process.env.SEASON_PASS_ACCEPT_LEGACY_GATE_CODES;
  const legacyToken = gateTokens.createLegacySeasonPassGateToken(
    assignmentA.barcode,
  );
  assert.equal(gateTokens.resolveSeasonPassGateCredential(legacyToken), null);
  assert.equal(
    gateTokens.resolveSeasonPassGateCredential(assignmentA.barcode),
    null,
  );

  process.env.SEASON_PASS_ACCEPT_LEGACY_GATE_CODES = "true";
  const credential = gateTokens.resolveSeasonPassGateCredential(legacyToken);
  assert.ok(credential);
  assert.equal(
    gateTokens.seasonPassGateCredentialMatchesRow(credential, {
      ...assignmentA,
      legacyGateAllowed: true,
    }),
    true,
  );
  assert.equal(
    gateTokens.seasonPassGateCredentialMatchesRow(credential, assignmentA),
    false,
  );

  if (previousLegacy === undefined) {
    delete process.env.SEASON_PASS_ACCEPT_LEGACY_GATE_CODES;
  } else {
    process.env.SEASON_PASS_ACCEPT_LEGACY_GATE_CODES = previousLegacy;
  }
});
