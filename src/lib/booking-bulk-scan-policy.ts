export type BulkScanBookingInput = {
  status: string;
  quantity: number;
  scanCount: number;
};

/**
 * Returns only the missing admissions for a confirmed match booking.
 * Existing scans are preserved, and every other booking status is excluded.
 */
export function getBulkScanDeficit(booking: BulkScanBookingInput): number {
  if (booking.status !== "CONFIRMED") return 0;

  const quantity = Math.max(0, Math.trunc(booking.quantity));
  const scanCount = Math.max(0, Math.trunc(booking.scanCount));
  return Math.max(quantity - scanCount, 0);
}
