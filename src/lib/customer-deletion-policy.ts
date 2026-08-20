export type CustomerHistoryCounts = {
  bookings: number;
  seasonPassPurchases: number;
  seasonPassOrders: number;
};

/**
 * Paid and unpaid ticket records are retained operational history. Hard-delete
 * is safe only when none of those records can fall back to a reusable email or
 * phone identity after the Customer row disappears.
 */
export function hasRetainedCustomerHistory(
  counts: CustomerHistoryCounts,
): boolean {
  return (
    counts.bookings > 0 ||
    counts.seasonPassPurchases > 0 ||
    counts.seasonPassOrders > 0
  );
}
