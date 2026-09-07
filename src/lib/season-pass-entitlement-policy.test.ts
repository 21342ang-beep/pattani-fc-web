import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSeasonPassInitialUses,
  classifySeasonPassForMatch,
} from "./season-pass-entitlement-policy";

test("a buyer starts with the full allowance before any league match is settled", () => {
  assert.equal(calculateSeasonPassInitialUses(15, 0), 15);
});

test("a buyer joining after one or two settled matches starts at 14 or 13", () => {
  assert.equal(calculateSeasonPassInitialUses(15, 1), 14);
  assert.equal(calculateSeasonPassInitialUses(15, 2), 13);
});

test("initial uses are clamped and can never become negative", () => {
  assert.equal(calculateSeasonPassInitialUses(15, 99), 0);
  assert.equal(calculateSeasonPassInitialUses(15, -2), 15);
});

test("a pass activated at kickoff counts as an existing holder", () => {
  const kickoff = new Date("2030-01-01T12:00:00.000Z");
  assert.equal(classifySeasonPassForMatch(new Date("2030-01-01T11:59:59.000Z"), kickoff), "HOLDER_AT_KICKOFF");
  assert.equal(classifySeasonPassForMatch(kickoff, kickoff), "HOLDER_AT_KICKOFF");
});

test("a pass activated after kickoff is a later-season purchase, not a no-show", () => {
  assert.equal(
    classifySeasonPassForMatch(
      new Date("2030-01-01T12:00:00.001Z"),
      new Date("2030-01-01T12:00:00.000Z"),
    ),
    "JOINED_AFTER_MATCH",
  );
});
