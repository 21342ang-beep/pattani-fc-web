import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_SCAN_ZONES,
  UNASSIGNED_SCAN_ZONE,
  buildScanZoneSummaries,
  resolveSelectedScanZone,
  scanZoneMatches,
} from "./scan-zone-summary";

test("buildScanZoneSummaries preserves preferred zone order and exact totals", () => {
  assert.deepEqual(
    buildScanZoneSummaries(
      [
        { zone: "A", scans: 2, total: 2 },
        { zone: "B", scans: 3, total: 4 },
        { zone: "A", scans: 1, total: 5 },
        { zone: null, scans: 1 },
      ],
      ["B", "A", "C"],
    ),
    [
      { zone: "B", scans: 3, total: 4 },
      { zone: "A", scans: 3, total: 7 },
      { zone: "C", scans: 0, total: 0 },
      { zone: UNASSIGNED_SCAN_ZONE, scans: 1, total: 0 },
    ],
  );
});

test("resolveSelectedScanZone accepts known zones case-insensitively and rejects unknown values", () => {
  const zones = ["A", "VIP-B", UNASSIGNED_SCAN_ZONE];
  assert.equal(resolveSelectedScanZone("vip-b", zones), "VIP-B");
  assert.equal(resolveSelectedScanZone(undefined, zones), ALL_SCAN_ZONES);
  assert.equal(resolveSelectedScanZone("unknown", zones), ALL_SCAN_ZONES);
});

test("scanZoneMatches supports all zones and explicit unassigned rows", () => {
  assert.equal(scanZoneMatches("A", ALL_SCAN_ZONES), true);
  assert.equal(scanZoneMatches("A", "B"), false);
  assert.equal(scanZoneMatches(null, UNASSIGNED_SCAN_ZONE), true);
});
