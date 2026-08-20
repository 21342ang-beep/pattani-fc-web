export type SeasonOrderPaymentShape = {
  purchaseId: string | null;
};

/** Grouped child orders must be paid only through their parent purchase. */
export function isStandaloneSeasonOrder(
  order: SeasonOrderPaymentShape,
): boolean {
  return order.purchaseId === null;
}
