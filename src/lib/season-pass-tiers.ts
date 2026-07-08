// บัตรสมาชิกรายปี (Season Pass) — pure data, share ระหว่าง /tickets และ /season-pass/apply
// ⚠️ อย่าเพิ่ม JSX ที่นี่ — ไฟล์นี้ต้อง import ได้จากทั้ง server และ client component

export const SEASON_MATCHES = 15;
export const SEASON_LABEL = "2026/27";

// ค่าจัดส่งบัตรสมาชิก (พัสดุไปที่บ้าน) — ไม่คิดเมื่อรับด้วยตัวเอง
export const SEASON_PASS_SHIPPING_FEE_BAHT = 50;

// สถานที่ให้เลือกรับบัตรด้วยตัวเอง
export const SEASON_PASS_PICKUP_LOCATIONS = [
  "สนามเรนโบว์สเตเดียม (Pattani FC)",
  "สำนักงานสโมสร Pattani FC",
  "สนามกีฬาติณสูลานนท์",
] as const;

export type SeasonTierId = "vvip-elite" | "vip-advanced" | "premium" | "gold";

export interface SeasonTier {
  id: SeasonTierId;
  badge: string;
  name: string;
  tagline: string;
  priceBaht: number; // ราคาเต็มบาท (ไม่ใช่สตางค์ — ไว้ display อย่างเดียว)
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
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "ที่นั่งโซนประธาน (VVIP) ประจำ",
      "ห้องรับรอง VVIP พร้อมเครื่องดื่ม/อาหารว่าง",
      "ทางเข้า/ที่จอดรถ VIP",
      "ของที่ระลึกพิเศษทุกแมตช์",
      "Welcome Kit Premium + บัตรสลักชื่อ",
      "ส่วนลด 30% ร้านค้าสโมสรตลอดปี",
    ],
    ribbon: "พรีเมียมสุด",
  },
  {
    id: "vip-advanced",
    badge: "VIP ADVANCED",
    name: "VIP ADVANCED MEMBER",
    tagline: "สแตนด์ VIP มีหลังคา ที่นั่งสบาย",
    priceBaht: 2500,
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "ที่นั่งโซน VIP (กลางสนาม มีหลังคา) ประจำ",
      "ทางเข้าโซนเฉพาะ ไม่ต้องต่อแถว",
      "Welcome Kit VIP + บัตรสมาชิก",
      "ของที่ระลึก 1 ชิ้น/แมตช์",
      "ส่วนลด 20% ร้านค้าสโมสร",
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
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "ที่นั่งโซนพรีเมียม (มีหลังคา) ประจำ",
      "บัตรสมาชิก Premium ประจำปี",
      "ของที่ระลึกต้อนรับ Welcome Gift",
      "ส่วนลด 15% ร้านค้าสโมสร",
    ],
  },
  {
    id: "gold",
    badge: "GOLD",
    name: "GOLD MEMBER",
    tagline: "จุดเริ่มต้นของแฟนพันธุ์แท้",
    priceBaht: 1500,
    benefits: [
      `เข้าชม ${SEASON_MATCHES} แมตช์เหย้าตลอดฤดูกาล`,
      "ที่นั่งโซนทั่วไปประจำ",
      "บัตรสมาชิก Gold ประจำปี",
      "ส่วนลด 10% ร้านค้าสโมสร",
    ],
  },
];

export function getSeasonTier(id: string | undefined | null): SeasonTier | null {
  if (!id) return null;
  return SEASON_TIERS.find((t) => t.id === id) ?? null;
}
