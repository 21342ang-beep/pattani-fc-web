import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPattaniHomeTeam,
  isSeasonPassEligibleMatch,
  seasonPassScanConsumesLeagueUse,
} from "./season-pass-home-match";

test("recognizes Pattani FC home-team aliases", () => {
  assert.equal(isPattaniHomeTeam("Pattani FC"), true);
  assert.equal(isPattaniHomeTeam("ปัตตานี เอฟซี"), true);
  assert.equal(isPattaniHomeTeam("Bangkok United"), false);
});

test("requires both the admin flag and Pattani FC as home team", () => {
  assert.equal(isSeasonPassEligibleMatch({ homeTeam: "Pattani FC", seasonPassEligible: true }), true);
  assert.equal(isSeasonPassEligibleMatch({ homeTeam: "Pattani FC", seasonPassEligible: false }), false);
  assert.equal(isSeasonPassEligibleMatch({ homeTeam: "Away Club", seasonPassEligible: true }), false);
});

test("cup scans never consume a league use", () => {
  assert.equal(seasonPassScanConsumesLeagueUse("LEAGUE"), true);
  assert.equal(seasonPassScanConsumesLeagueUse("CUP"), false);
});
