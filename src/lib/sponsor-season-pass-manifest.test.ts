import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SPONSOR_SEASON_PASS_ENTRIES,
  sponsorSeasonPassAuditMarker,
} from "./sponsor-season-pass-manifest";

test("sponsor manifest contains exactly the 91 currently issued allocations", () => {
  assert.equal(SPONSOR_SEASON_PASS_ENTRIES.length, 91);
  assert.equal(new Set(SPONSOR_SEASON_PASS_ENTRIES.map((entry) => entry.barcode)).size, 91);
  assert.deepEqual(
    Object.fromEntries(
      ["vip-advanced", "premium", "gold"].map((tierId) => [
        tierId,
        SPONSOR_SEASON_PASS_ENTRIES.filter((entry) => entry.tierId === tierId).length,
      ]),
    ),
    { "vip-advanced": 46, premium: 13, gold: 32 },
  );
  assert.equal(
    new Set(SPONSOR_SEASON_PASS_ENTRIES.map(sponsorSeasonPassAuditMarker)).size,
    91,
  );
});

test("VIP-A uses only issued 0144-0189 and excludes held or lost cards", () => {
  const vipEntries = SPONSOR_SEASON_PASS_ENTRIES.filter(
    (entry) => entry.tierId === "vip-advanced",
  );
  const issuedSequences = vipEntries
    .map((entry) => Number(entry.barcode.slice(-4)))
    .sort((a, b) => a - b);

  assert.deepEqual(issuedSequences, [
    ...Array.from({ length: 46 }, (_, index) => 144 + index),
  ]);
  assert.equal(issuedSequences.includes(141), false);
  assert.equal(issuedSequences.includes(142), false);
  assert.equal(issuedSequences.includes(143), false);
  assert.equal(issuedSequences.includes(192), false);
  assert.equal(issuedSequences.includes(193), false);
  assert.equal(issuedSequences.includes(190), false);
  assert.equal(issuedSequences.includes(191), false);

  assert.deepEqual(
    vipEntries.slice(0, 3).map((entry) => [entry.sourceBarcode, entry.barcode]),
    [
      ["PFC26-2500-0141", "PFC26-2500-0144"],
      ["PFC26-2500-0142", "PFC26-2500-0145"],
      ["PFC26-2500-0143", "PFC26-2500-0146"],
    ],
  );
  assert.deepEqual(
    vipEntries.at(-1) && [vipEntries.at(-1)!.sourceBarcode, vipEntries.at(-1)!.barcode],
    ["PFC26-2500-0186", "PFC26-2500-0189"],
  );
});

test("Premium and Gold allocations stay on their printed barcode numbers", () => {
  const premium = SPONSOR_SEASON_PASS_ENTRIES.filter((entry) => entry.tierId === "premium");
  const gold = SPONSOR_SEASON_PASS_ENTRIES.filter((entry) => entry.tierId === "gold");

  assert.equal(premium[0]?.barcode, "PFC26-2000-0988");
  assert.equal(premium.at(-1)?.barcode, "PFC26-2000-1000");
  assert.ok(premium.every((entry) => entry.barcode === entry.sourceBarcode));
  assert.ok(premium.every((entry) => entry.seatZone === "PRIMIUM-F"));

  assert.equal(gold[0]?.barcode, "PFC26-1500-0769");
  assert.equal(gold.at(-1)?.barcode, "PFC26-1500-0800");
  assert.ok(gold.every((entry) => entry.barcode === entry.sourceBarcode));
  assert.ok(gold.every((entry) => entry.seatZone === "GOLD-J"));
});
