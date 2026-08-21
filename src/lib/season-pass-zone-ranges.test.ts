import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSeasonPassZoneBarcodeBounds,
  resolveSeasonPassBarcodeZoneQuotas,
  seasonPassBarcodeIsWithinBounds,
} from "./season-pass-zone-ranges";

const quotas = [
  { seatZone: "VIP-A", totalSeats: 40, sponsorReserved: 3 },
  { seatZone: "VIP-B", totalSeats: 80, sponsorReserved: 1 },
];

test("resolves a zone-specific public barcode interval", () => {
  const bounds = getSeasonPassZoneBarcodeBounds(
    "PFC26-2500-",
    ["VIP-A", "VIP-B"],
    quotas,
    "VIP-B",
  );

  assert.deepEqual(bounds, {
    seatZone: "VIP-B",
    lowerBound: "PFC26-2500-0041",
    upperBound: "PFC26-2500-0119",
    publicSeatCount: 79,
  });
  assert.equal(seasonPassBarcodeIsWithinBounds("PFC26-2500-0041", bounds!), true);
  assert.equal(seasonPassBarcodeIsWithinBounds("PFC26-2500-0119", bounds!), true);
  assert.equal(seasonPassBarcodeIsWithinBounds("PFC26-2500-0120", bounds!), false);
});

test("does not guess a zone interval when quota configuration is incomplete", () => {
  const bounds = getSeasonPassZoneBarcodeBounds(
    "PFC26-2500-",
    ["VIP-A", "VIP-B"],
    quotas.slice(0, 1),
    "VIP-B",
  );

  assert.equal(bounds, null);
});

test("a zone with no public seats cannot accept a barcode", () => {
  const bounds = getSeasonPassZoneBarcodeBounds(
    "PFC26-4000-",
    ["VVIP-A"],
    [{ seatZone: "VVIP-A", totalSeats: 5, sponsorReserved: 5 }],
    "VVIP-A",
  );

  assert.ok(bounds);
  assert.equal(bounds.publicSeatCount, 0);
  assert.equal(seasonPassBarcodeIsWithinBounds("PFC26-4000-0001", bounds), false);
});

test("uses the fixed printed VVIP barcode blocks when DB quotas are absent", () => {
  const resolved = resolveSeasonPassBarcodeZoneQuotas(
    "2026/27",
    "vvip-elite",
    "PFC26-4000-",
    ["VVIP-A", "VVIP-B"],
    [],
  );

  assert.deepEqual(resolved, [
    { seatZone: "VVIP-A", totalSeats: 80, sponsorReserved: 0 },
    { seatZone: "VVIP-B", totalSeats: 80, sponsorReserved: 0 },
  ]);
  const vvipABounds = getSeasonPassZoneBarcodeBounds(
    "PFC26-4000-",
    ["VVIP-A", "VVIP-B"],
    resolved,
    "VVIP-A",
  );
  assert.deepEqual(vvipABounds, {
    seatZone: "VVIP-A",
    lowerBound: "PFC26-4000-0001",
    upperBound: "PFC26-4000-0080",
    publicSeatCount: 80,
  });
  assert.equal(
    seasonPassBarcodeIsWithinBounds("PFC26-4000-0081", vvipABounds!),
    false,
  );
  assert.deepEqual(
    getSeasonPassZoneBarcodeBounds(
      "PFC26-4000-",
      ["VVIP-A", "VVIP-B"],
      resolved,
      "VVIP-B",
    ),
    {
      seatZone: "VVIP-B",
      lowerBound: "PFC26-4000-0081",
      upperBound: "PFC26-4000-0160",
      publicSeatCount: 80,
    },
  );
});

test("does not invent barcode blocks for another tier with incomplete quotas", () => {
  assert.deepEqual(
    resolveSeasonPassBarcodeZoneQuotas(
      "2026/27",
      "premium",
      "PFC26-2000-",
      ["PRIMIUM-A", "PRIMIUM-B", "PRIMIUM-F"],
      [{ seatZone: "PRIMIUM-A", totalSeats: 200, sponsorReserved: 0 }],
    ),
    [],
  );
});

test("does not carry a fixed printed range into a future season", () => {
  assert.deepEqual(
    resolveSeasonPassBarcodeZoneQuotas(
      "2027/28",
      "vvip-elite",
      "PFC27-4000-",
      ["VVIP-A", "VVIP-B"],
      [],
    ),
    [],
  );
});

test("does not apply the fixed VVIP split to another barcode prefix", () => {
  assert.deepEqual(
    resolveSeasonPassBarcodeZoneQuotas(
      "2026/27",
      "vvip-elite",
      "PFC26-4500-",
      ["VVIP-A", "VVIP-B"],
      [],
    ),
    [],
  );
});
