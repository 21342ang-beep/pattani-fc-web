import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSeasonPassZoneBarcodeBounds,
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
