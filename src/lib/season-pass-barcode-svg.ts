/** Physical size for printing on the 8.5 cm × 5.35 cm season-pass card. */
export const SEASON_PASS_BARCODE_WIDTH_MM = 53.8;
export const SEASON_PASS_BARCODE_HEIGHT_MM = 12;

/**
 * bwip-js emits a responsive SVG without physical dimensions.  Embed mm units
 * so printers and card-design software keep the barcode at its intended size.
 */
export function withSeasonPassBarcodePrintSize(svg: string): string {
  return svg.replace(
    "<svg ",
    `<svg width="${SEASON_PASS_BARCODE_WIDTH_MM}mm" height="${SEASON_PASS_BARCODE_HEIGHT_MM}mm" `,
  );
}
