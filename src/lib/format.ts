// helper format ราคา (สตางค์ → บาท) และวันที่ภาษาไทย

export function formatBaht(amountSatang: number, locale = "th-TH"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(amountSatang / 100);
}

export function formatDateTime(d: Date | string, locale = "th-TH"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}
