const SPREADSHEET_FORMULA_PREFIX = /^[\s\u0000-\u001f\u200b\ufeff]*[=+\-@]/u;

/**
 * Escapes one RFC 4180-style CSV cell and neutralizes spreadsheet formulas.
 * Quoting alone does not make values such as `=HYPERLINK(...)` safe in Excel,
 * so potentially executable text is prefixed with an apostrophe first.
 */
export function escapeCsvCell(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "";

  const raw = String(value);
  const safe = SPREADSHEET_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;

  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}
