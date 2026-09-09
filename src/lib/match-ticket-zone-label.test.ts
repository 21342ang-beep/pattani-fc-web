import assert from "node:assert/strict";
import test from "node:test";
import {
  getMatchTicketZoneButtonLabel,
  isValidMatchTicketZoneButtonLabel,
  sanitizeMatchTicketZoneButtonLabelInput,
} from "./match-ticket-zone-label";

test("keeps supported punctuation and numbers in an explicit button label", () => {
  for (const buttonLabel of ["F1/F2", "VIP-A", "A + B", "วีไอพี-ฝั่งประธาน/สปอนเซอร์"]) {
    assert.equal(
      getMatchTicketZoneButtonLabel({ buttonLabel, code: "EXTRA-1", name: "โซนพิเศษ" }),
      buttonLabel,
    );
    assert.equal(isValidMatchTicketZoneButtonLabel(buttonLabel), true);
  }
});

test("does not impose a per-label character limit", () => {
  const buttonLabel = "โซนพิเศษ/".repeat(100);
  assert.equal(sanitizeMatchTicketZoneButtonLabelInput(buttonLabel), buttonLabel);
  assert.equal(isValidMatchTicketZoneButtonLabel(buttonLabel), true);
});

test("normalizes case and removes control characters from typed input", () => {
  assert.equal(sanitizeMatchTicketZoneButtonLabelInput("vip-a\n/f1"), "VIP-A/F1");
});

test("falls back safely when a stored label contains a control character", () => {
  assert.equal(
    getMatchTicketZoneButtonLabel({ buttonLabel: "VIP\nA", code: "EXTRA-B", name: "โซนพิเศษ" }),
    "B",
  );
});
