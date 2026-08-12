// บัตรสมาชิกรายปี (Season Pass) — pure data, share ระหว่าง /tickets และ /season-pass/apply
// ⚠️ อย่าเพิ่ม JSX ที่นี่ — ไฟล์นี้ต้อง import ได้จากทั้ง server และ client component

export const SEASON_MATCHES = 15;
export const SEASON_LABEL = "2026/27";

// ค่าจัดส่งบัตรสมาชิก (พัสดุไปที่บ้าน) — ไม่คิดเมื่อรับด้วยตัวเอง
export const SEASON_PASS_SHIPPING_FEE_BAHT = 50;

// สถานที่ให้เลือกรับบัตรด้วยตัวเอง
export const SEASON_PASS_PICKUP_LOCATIONS = [
  "สโมสร",
  "HiHiBuffet",
  "Maisz",
] as const;
export type SeasonPassPickupLocation = (typeof SEASON_PASS_PICKUP_LOCATIONS)[number];

// ที่อยู่ + หมุดแผนที่ของแต่ละจุดรับ — ให้ลูกค้ากดนำทางได้จากฟอร์ม
function mapSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export const SEASON_PASS_PICKUP_LOCATION_INFO: Record<
  SeasonPassPickupLocation,
  { address: string; mapUrl: string }
> = {
  "สโมสร": {
    address: "140 3 ถนนยะรัง ตำบลจะบังติกอ อำเภอเมืองปัตตานี ปัตตานี 94000",
    mapUrl: mapSearchUrl("Pattani FC 140 3 ถนนยะรัง ตำบลจะบังติกอ อำเภอเมืองปัตตานี ปัตตานี 94000"),
  },
  HiHiBuffet: {
    address: "ถ.หน้าสงเคราะห์ ตำบลรูสะมิแล อำเภอเมืองปัตตานี ปัตตานี 94000",
    mapUrl: mapSearchUrl("HiHiBuffet ถ.หน้าสงเคราะห์ ตำบลรูสะมิแล อำเภอเมืองปัตตานี ปัตตานี 94000"),
  },
  Maisz: {
    address: "4, 12 ถ.รามโกมุท ตำบลบานา อำเภอเมืองปัตตานี ปัตตานี 94000",
    mapUrl: mapSearchUrl("Maisz 4, 12 ถ.รามโกมุท ตำบลบานา อำเภอเมืองปัตตานี ปัตตานี 94000"),
  },
};

export type SeasonTierId = "vvip-elite" | "vip-advanced" | "premium" | "gold";
export const SEASON_PASS_SHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;

export function seasonTierIncludesShirt(tierId: string): boolean {
  return tierId === "vvip-elite" || tierId === "vip-advanced";
}

export const SEASON_PASS_SEAT_ZONES = [
  "VVIP-A",
  "VVIP-B",
  "VIP-A",
  "VIP-B",
  "PRIMIUM-A",
  "PRIMIUM-B",
  "PRIMIUM-F",
  "GOLD-C",
  "GOLD-E",
  "GOLD-G",
  "GOLD-J",
] as const;
export type SeasonPassSeatZone = (typeof SEASON_PASS_SEAT_ZONES)[number];

export interface SeasonTier {
  id: SeasonTierId;
  badge: string;
  name: string;
  tagline: string;
  priceBaht: number; // ราคาเต็มบาท (ไม่ใช่สตางค์ — ไว้ display อย่างเดียว)
  inventory?: {
    total: number;
    sponsorReserved: number;
  };
  allowedSeatZones: readonly SeasonPassSeatZone[];
  benefits: string[];
  highlight?: boolean;
  ribbon?: string;
}

export const SEASON_TIERS: SeasonTier[] = [
  {
    id: "vvip-elite",
    badge: "VVIP ELITE",
    name: "VVIP ELITE MEMBER",
    tagline: "ประสบการณ์ระดับประธานสโมสร",
    priceBaht: 4000,
    allowedSeatZones: ["VVIP-A", "VVIP-B"],
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "บัตรสมาชิก VVIP + ที่นั่งประจำ (ระบุที่ชัดเจน)",
      "เสื้อเหย้าสโมสร 1 ตัว",
      "บัตรและเสื้อจะได้รับภายใน 2–3 วันหลังจากทำการซื้อบัตร",
      "มีสิทธิ์ร่วมลุ้นของที่ระลึก จากกิจกรรมของสโมสร",
    ],
    ribbon: "พรีเมียมสุด",
  },
  {
    id: "vip-advanced",
    badge: "VIP ADVANCED",
    name: "VIP ADVANCED MEMBER",
    tagline: "สแตนด์ VIP มีหลังคา ที่นั่งสบาย",
    priceBaht: 2500,
    inventory: { total: 386, sponsorReserved: 35 },
    allowedSeatZones: ["VIP-A", "VIP-B"],
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "บัตรสมาชิก VIP + ที่นั่งประจำโซน VIP",
      "เสื้อแข่ง(เหย้า) 1 ตัว",
      "รับบัตรและเสื้อ จะประกาศอีกครั้งจากทางสโมสรฯ",
      "มีสิทธิ์ร่วมลุ้นของที่ระลึก จากกิจกรรมของสโมสร",
    ],
    highlight: true,
    ribbon: "ยอดนิยม · คุ้มที่สุด",
  },
  {
    id: "premium",
    badge: "PREMIUM",
    name: "PREMIUM MEMBER",
    tagline: "โซนพรีเมียม บรรยากาศพร้อมเชียร์",
    priceBaht: 2000,
    inventory: { total: 1000, sponsorReserved: 12 },
    allowedSeatZones: ["PRIMIUM-A", "PRIMIUM-B", "PRIMIUM-F"],
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "บัตรสมาชิก Premium ประจำปี",
      "มีสิทธิ์ร่วมลุ้นของที่ระลึก จากกิจกรรมของสโมสร",
    ],
  },
  {
    id: "gold",
    badge: "GOLD",
    name: "GOLD MEMBER",
    tagline: "จุดเริ่มต้นของแฟนพันธุ์แท้",
    priceBaht: 1500,
    inventory: { total: 800, sponsorReserved: 21 },
    allowedSeatZones: ["GOLD-C", "GOLD-E", "GOLD-G", "GOLD-J"],
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "บัตรสมาชิก Gold ประจำปี",
      "มีสิทธิ์ร่วมลุ้นของที่ระลึก จากกิจกรรมของสโมสร",
    ],
  },
];

export function getSeasonTier(id: string | undefined | null): SeasonTier | null {
  if (!id) return null;
  return SEASON_TIERS.find((t) => t.id === id) ?? null;
}

export function getSeasonPublicSaleLimit(tier: SeasonTier): number | null {
  if (!tier.inventory) return null;
  return Math.max(0, tier.inventory.total - tier.inventory.sponsorReserved);
}
