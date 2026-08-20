import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeCsvCell } from "./csv";

test("escapes CSV delimiters and quotes", () => {
  assert.equal(escapeCsvCell("plain text"), "plain text");
  assert.equal(escapeCsvCell('Pattani, "FC"'), '"Pattani, ""FC"""');
  assert.equal(escapeCsvCell("line 1\nline 2"), '"line 1\nline 2"');
  assert.equal(escapeCsvCell(null), "");
});

test("neutralizes spreadsheet formula prefixes, including hidden whitespace", () => {
  for (const value of [
    "=HYPERLINK(\"https://example.invalid\")",
    "+cmd|' /C calc'!A0",
    "-cmd|' /C calc'!A0",
    "@SUM(1+1)",
    "  =1+1",
    "\t=1+1",
    "\u200b=1+1",
  ]) {
    const escaped = escapeCsvCell(value);
    assert.equal(
      escaped.startsWith("'") || escaped.startsWith("\"'"),
      true,
      `expected a neutralizing apostrophe for ${JSON.stringify(value)}`,
    );
  }
});

test("does not alter ordinary numeric cells", () => {
  assert.equal(escapeCsvCell(170), "170");
  assert.equal(escapeCsvCell("0812345678"), "0812345678");
});
