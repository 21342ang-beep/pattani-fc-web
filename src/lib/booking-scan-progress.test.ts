import assert from "node:assert/strict";
import test from "node:test";
import { getBookingScanProgress } from "./booking-scan-progress";

test("a confirmed booking starts with every admission remaining", () => {
  assert.deepEqual(getBookingScanProgress(3, 0), {
    scannedTickets: 0,
    remainingTickets: 3,
    fullyScanned: false,
  });
});

test("each gate scan reduces the remaining admission count", () => {
  assert.deepEqual(getBookingScanProgress(3, 1), {
    scannedTickets: 1,
    remainingTickets: 2,
    fullyScanned: false,
  });
});

test("a booking becomes fully scanned only when all admissions are used", () => {
  assert.deepEqual(getBookingScanProgress(3, 3), {
    scannedTickets: 3,
    remainingTickets: 0,
    fullyScanned: true,
  });
});

test("remaining admissions never become negative", () => {
  assert.deepEqual(getBookingScanProgress(1, 2), {
    scannedTickets: 2,
    remainingTickets: 0,
    fullyScanned: true,
  });
});
