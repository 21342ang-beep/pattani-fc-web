// Cart ฝั่ง client — เก็บใน localStorage
// ปลอดภัย: เป็น UI state ล้วน — server จะคำนวณราคา/เช็คสินค้าใหม่ทั้งหมดตอน checkout
// (ห้ามใช้ราคาจาก cart ตอนสร้างออเดอร์)

export type ShopCartItem = {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPriceBaht: number; // ราคา ณ ตอนหยิบลงตะกร้า — ใช้แสดงผลเท่านั้น
  quantity: number;
  size?: string;
};

const STORAGE_KEY = "pattanifc:shop-cart:v1";
const MAX_QTY_PER_LINE = 20;
const MAX_LINES = 30;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// validate item แบบเข้มงวด — ทุก field ต้องผ่าน type guard
// กัน localStorage ถูกแก้มือแล้ว crash UI
function sanitizeItem(raw: unknown): ShopCartItem | null {
  if (!isPlainObject(raw)) return null;
  const productId = typeof raw.productId === "string" ? raw.productId.slice(0, 64) : null;
  const name = typeof raw.name === "string" ? raw.name.slice(0, 200) : null;
  const imageUrl =
    typeof raw.imageUrl === "string" && raw.imageUrl.length < 500 ? raw.imageUrl : null;
  const unitPriceBaht =
    typeof raw.unitPriceBaht === "number" && Number.isFinite(raw.unitPriceBaht) && raw.unitPriceBaht >= 0
      ? Math.min(Math.round(raw.unitPriceBaht), 1_000_000)
      : null;
  const quantity =
    typeof raw.quantity === "number" && Number.isInteger(raw.quantity)
      ? Math.max(1, Math.min(raw.quantity, MAX_QTY_PER_LINE))
      : null;
  const size = typeof raw.size === "string" && raw.size.length <= 16 ? raw.size : undefined;
  if (!productId || !name || unitPriceBaht == null || !quantity) return null;
  return { productId, name, imageUrl, unitPriceBaht, quantity, size };
}

export function readCart(): ShopCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, MAX_LINES)
      .map(sanitizeItem)
      .filter((x): x is ShopCartItem => x !== null);
  } catch {
    return [];
  }
}

export function writeCart(items: ShopCartItem[]): void {
  if (typeof window === "undefined") return;
  const trimmed = items.slice(0, MAX_LINES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  // broadcast ให้ component อื่นอัปเดต count
  window.dispatchEvent(new CustomEvent("shop-cart:change"));
}

// merge key: productId + size (ไซส์ต่างกัน → คนละบรรทัด)
function lineKey(productId: string, size?: string): string {
  return `${productId}|${size ?? ""}`;
}

export function addToCart(item: ShopCartItem): ShopCartItem[] {
  const current = readCart();
  const key = lineKey(item.productId, item.size);
  const next = [...current];
  const idx = next.findIndex((x) => lineKey(x.productId, x.size) === key);
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      quantity: Math.min(next[idx].quantity + item.quantity, MAX_QTY_PER_LINE),
    };
  } else {
    if (next.length >= MAX_LINES) return current;
    next.push({ ...item, quantity: Math.min(item.quantity, MAX_QTY_PER_LINE) });
  }
  writeCart(next);
  return next;
}

export function updateQty(
  productId: string,
  size: string | undefined,
  qty: number
): ShopCartItem[] {
  const key = lineKey(productId, size);
  const next = readCart().map((it) =>
    lineKey(it.productId, it.size) === key
      ? { ...it, quantity: Math.max(1, Math.min(Math.round(qty), MAX_QTY_PER_LINE)) }
      : it
  );
  writeCart(next);
  return next;
}

export function removeItem(productId: string, size: string | undefined): ShopCartItem[] {
  const key = lineKey(productId, size);
  const next = readCart().filter((it) => lineKey(it.productId, it.size) !== key);
  writeCart(next);
  return next;
}

export function clearCart(): void {
  writeCart([]);
}

export function cartCount(items: ShopCartItem[]): number {
  return items.reduce((sum, it) => sum + it.quantity, 0);
}

export function cartSubtotalBaht(items: ShopCartItem[]): number {
  return items.reduce((sum, it) => sum + it.unitPriceBaht * it.quantity, 0);
}

// ค่าจัดส่ง (เก็บค่า "ตามจริง" ที่ server ใช้คำนวณซ้ำ — ห้ามเชื่อ client)
export const SHIPPING_FEE_BAHT: Record<"STANDARD" | "EXPRESS" | "PICKUP", number> = {
  STANDARD: 50,
  EXPRESS: 80,
  PICKUP: 0,
};

export const SHIPPING_LABEL: Record<"STANDARD" | "EXPRESS" | "PICKUP", string> = {
  STANDARD: "ไปรษณีย์ไทย / EMS (3-5 วัน)",
  EXPRESS: "ส่งด่วน Kerry / Flash (1-2 วัน)",
  PICKUP: "รับเองที่สโมสร (Rainbow Stadium)",
};

export const PAYMENT_LABEL: Record<"PROMPTPAY" | "BANK_TRANSFER" | "COD", string> = {
  PROMPTPAY: "PromptPay QR",
  BANK_TRANSFER: "โอนผ่านธนาคาร",
  COD: "เก็บปลายทาง",
};
