export type BookingScanProgress = {
  scannedTickets: number;
  remainingTickets: number;
  fullyScanned: boolean;
};

/**
 * One BookingGateScan consumes one admission from a confirmed match booking.
 * Keep the original booking quantity intact for sales, payment and audit data.
 */
export function getBookingScanProgress(
  quantity: number,
  scanCount: number,
): BookingScanProgress {
  const safeQuantity = Math.max(0, Math.trunc(quantity));
  const safeScanCount = Math.max(0, Math.trunc(scanCount));

  return {
    scannedTickets: safeScanCount,
    remainingTickets: Math.max(safeQuantity - safeScanCount, 0),
    fullyScanned: safeQuantity > 0 && safeScanCount >= safeQuantity,
  };
}
