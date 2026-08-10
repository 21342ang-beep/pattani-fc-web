import "server-only";

import { deflateRawSync } from "node:zlib";

export type XlsxCell = string | number | Date | null;

type WorkbookOptions = {
  sheetName: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: XlsxCell[][];
  columnWidths?: number[];
  currencyColumns?: number[];
  dateColumns?: number[];
  textColumns?: number[];
  dateTimeOffsetMinutes?: number;
};

const encoder = new TextEncoder();

export function createXlsxWorkbook(options: WorkbookOptions): Uint8Array {
  const files = new Map<string, Uint8Array>();
  const sheetXml = createSheetXml(options);

  files.set("[Content_Types].xml", encoder.encode(contentTypesXml));
  files.set("_rels/.rels", encoder.encode(rootRelationshipsXml));
  files.set("xl/workbook.xml", encoder.encode(createWorkbookXml(options.sheetName)));
  files.set("xl/_rels/workbook.xml.rels", encoder.encode(workbookRelationshipsXml));
  files.set("xl/styles.xml", encoder.encode(stylesXml));
  files.set("xl/worksheets/sheet1.xml", encoder.encode(sheetXml));

  return createZip(files);
}

function createSheetXml(options: WorkbookOptions) {
  const headerRowNumber = options.subtitle ? 4 : 3;
  const dataStartRow = headerRowNumber + 1;
  const lastColumn = columnName(options.headers.length);
  const lastRow = Math.max(headerRowNumber, dataStartRow + options.rows.length - 1);
  const currencyColumns = new Set(options.currencyColumns ?? []);
  const dateColumns = new Set(options.dateColumns ?? []);
  const textColumns = new Set(options.textColumns ?? []);
  const widths = options.columnWidths ?? options.headers.map(() => 16);

  const rows: string[] = [];
  rows.push(
    `<row r="1" ht="30" customHeight="1"><c r="A1" s="1" t="inlineStr"><is><t>${escapeXml(options.title)}</t></is></c></row>`,
  );
  if (options.subtitle) {
    rows.push(
      `<row r="2" ht="22" customHeight="1"><c r="A2" s="2" t="inlineStr"><is><t>${escapeXml(options.subtitle)}</t></is></c></row>`,
    );
  }

  rows.push(
    `<row r="${headerRowNumber}" ht="34" customHeight="1">${options.headers
      .map(
        (header, index) =>
          `<c r="${columnName(index + 1)}${headerRowNumber}" s="3" t="inlineStr"><is><t>${escapeXml(header)}</t></is></c>`,
      )
      .join("")}</row>`,
  );

  options.rows.forEach((row, rowIndex) => {
    const excelRow = dataStartRow + rowIndex;
    const cells = options.headers.map((_, columnIndex) => {
      const value = row[columnIndex] ?? null;
      const reference = `${columnName(columnIndex + 1)}${excelRow}`;
      const oneBasedColumn = columnIndex + 1;
      if (value instanceof Date) {
        return `<c r="${reference}" s="6"><v>${excelDate(value, options.dateTimeOffsetMinutes ?? 0)}</v></c>`;
      }
      if (typeof value === "number" && !textColumns.has(oneBasedColumn)) {
        const style = currencyColumns.has(oneBasedColumn) ? 5 : 4;
        return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
      }
      const style = dateColumns.has(oneBasedColumn) ? 6 : 4;
      return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value == null ? "" : String(value))}</t></is></c>`;
    });
    rows.push(`<row r="${excelRow}">${cells.join("")}</row>`);
  });

  const merges = options.subtitle
    ? `<mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>`
    : `<mergeCells count="1"><mergeCell ref="A1:${lastColumn}1"/></mergeCells>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${headerRowNumber}" topLeftCell="A${dataStartRow}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
  <sheetData>${rows.join("")}</sheetData>
  <autoFilter ref="A${headerRowNumber}:${lastColumn}${lastRow}"/>
  ${merges}
</worksheet>`;
}

function createWorkbookXml(sheetName: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(column: number) {
  let name = "";
  while (column > 0) {
    const remainder = (column - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    column = Math.floor((column - 1) / 26);
  }
  return name;
}

function excelDate(date: Date, offsetMinutes: number) {
  return (date.getTime() + offsetMinutes * 60_000) / 86_400_000 + 25_569;
}

function createZip(files: Map<string, Uint8Array>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of files) {
    const nameBytes = encoder.encode(name);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 8, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, compressed.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, compressed);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 8, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, compressed.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.size, true);
  endView.setUint16(10, files.size, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...localParts, centralDirectory, end]);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const rootRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const workbookRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="#\,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
  <fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF14532D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF166534"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
