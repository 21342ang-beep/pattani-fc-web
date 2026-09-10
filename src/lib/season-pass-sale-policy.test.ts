import assert from "node:assert/strict";
import test from "node:test";
import {
  getOpenSeasonPassTierIds,
  isPublicSeasonPassTierId,
  isSeasonPassTierBookingOpen,
} from "./season-pass-sale-policy";

test("each public season-pass package has an independent sale state", () => {
  const settings = {
    seasonPassVipAdvancedOpen: true,
    seasonPassPremiumOpen: false,
    seasonPassGoldOpen: true,
  };

  assert.equal(isSeasonPassTierBookingOpen(settings, "vip-advanced"), true);
  assert.equal(isSeasonPassTierBookingOpen(settings, "premium"), false);
  assert.equal(isSeasonPassTierBookingOpen(settings, "gold"), true);
  assert.deepEqual(getOpenSeasonPassTierIds(settings), ["vip-advanced", "gold"]);
});

test("internal and unknown packages cannot be opened for public sale", () => {
  const settings = {
    seasonPassVipAdvancedOpen: true,
    seasonPassPremiumOpen: true,
    seasonPassGoldOpen: true,
  };

  assert.equal(isSeasonPassTierBookingOpen(settings, "vvip-elite"), false);
  assert.equal(isSeasonPassTierBookingOpen(settings, "unknown"), false);
  assert.equal(isPublicSeasonPassTierId("vvip-elite"), false);
  assert.equal(isPublicSeasonPassTierId("premium"), true);
});
