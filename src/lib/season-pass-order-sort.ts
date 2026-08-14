const barcodeCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export type SortableSeasonPassOrder = {
  id: string;
  passCode: string;
  status: string;
  createdAt: Date;
  barcode: { barcode: string } | null;
};

function getBarcodeSortValue(order: SortableSeasonPassOrder) {
  if (order.barcode?.barcode) return order.barcode.barcode;

  const expiredPrefix = `EXPIRED-${order.id}-`;
  if (order.passCode.startsWith(expiredPrefix)) {
    return order.passCode.slice(expiredPrefix.length) || null;
  }
  if (order.passCode.startsWith("PENDING-")) return null;
  return order.passCode || null;
}

export function compareSeasonPassOrders(
  left: SortableSeasonPassOrder,
  right: SortableSeasonPassOrder,
) {
  const leftBarcode = getBarcodeSortValue(left);
  const rightBarcode = getBarcodeSortValue(right);
  const leftGroup = !leftBarcode
    ? 2
    : ["CANCELLED", "REFUNDED"].includes(left.status)
      ? 1
      : 0;
  const rightGroup = !rightBarcode
    ? 2
    : ["CANCELLED", "REFUNDED"].includes(right.status)
      ? 1
      : 0;

  if (leftGroup !== rightGroup) return leftGroup - rightGroup;
  if (leftBarcode && rightBarcode) {
    const barcodeOrder = barcodeCollator.compare(leftBarcode, rightBarcode);
    if (barcodeOrder !== 0) return barcodeOrder;
  } else if (leftBarcode) {
    return -1;
  } else if (rightBarcode) {
    return 1;
  }
  return right.createdAt.getTime() - left.createdAt.getTime();
}
