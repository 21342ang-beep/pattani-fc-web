import { z } from "zod";
import { isPattaniHomeTeam } from "@/lib/season-pass-home-match";
import { STADIUM_ZONE_CODES } from "@/lib/stadium-zones";

// validate input ทุก API → ป้องกัน invalid data / injection

// Match — fields รองสามารถเว้นว่างได้ (draft mode)
// แต่ถ้าตั้งสถานะ ON_SALE ต้องครบทุก field (refinement ด้านล่าง)
// path โล้โก้ → รับเฉพาะรูปแบบที่ saveTeamLogo() สร้างเท่านั้น (UUID + ext จำกัด)
// → กัน path traversal และ inject URL ภายนอก
const teamLogoPath = z
  .string()
  .trim()
  .regex(/^\/uploads\/matches\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/, "รูปแบบ path ไม่ถูกต้อง")
  .nullish();

const matchBaseSchema = z.object({
  homeTeam: z.string().trim().min(1).max(100),
  awayTeam: z.string().trim().min(1).max(100),
  homeTeamLogo: teamLogoPath,
  awayTeamLogo: teamLogoPath,
  venue: z.string().trim().min(1).max(200).nullish(),
  kickoffAt: z.coerce.date().nullish(),
  totalSeats: z.number().int().positive().max(200000).nullish(),
  zoneASeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneBSeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneCSeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneDSeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneESeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneFSeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneGSeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneISeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneJSeats: z.number().int().nonnegative().max(200000).nullish(),
  zone170Seats: z.number().int().nonnegative().max(200000).nullish(),
  zone150Seats: z.number().int().nonnegative().max(200000).nullish(),
  zone120Seats: z.number().int().nonnegative().max(200000).nullish(),
  zone100Seats: z.number().int().nonnegative().max(200000).nullish(),
  zoneAwaySeats: z.number().int().nonnegative().max(200000).nullish(),
  zoneAPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneBPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneCPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneDPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneEPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneFPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneGPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneIPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneJPrice: z.number().int().positive().max(10_000_000).nullish(),
  zoneAwayPrice: z.number().int().positive().max(10_000_000).nullish(),
  // ราคาต่ำสุดของแมตช์ ใช้สำหรับการ์ดประชาสัมพันธ์และคำนวณจากราคารายโซนเท่านั้น
  pricePerSeat: z.number().int().positive().max(10_000_000).nullish(),
  competitionType: z.enum(["LEAGUE", "CUP"]).optional(),
  competitionName: z.string().trim().max(150).nullish(),
  competitionRound: z.string().trim().max(100).nullish(),
  seasonPassEligible: z.boolean().optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["SCHEDULED", "ON_SALE", "SOLD_OUT", "CANCELLED", "FINISHED"]).optional(),
});

// guard: ON_SALE ต้องมี field สำคัญครบ — กันลูกค้าจองตั๋วแมตช์ที่ยังไม่มีวัน/ราคา/ที่นั่ง
type MatchShape = {
  homeTeam?: string;
  seasonPassEligible?: boolean;
  venue?: string | null;
  kickoffAt?: Date | null;
  totalSeats?: number | null;
  zoneASeats?: number | null;
  zoneBSeats?: number | null;
  zoneCSeats?: number | null;
  zoneDSeats?: number | null;
  zoneESeats?: number | null;
  zoneFSeats?: number | null;
  zoneGSeats?: number | null;
  zoneISeats?: number | null;
  zoneJSeats?: number | null;
  zoneAwaySeats?: number | null;
  zoneAPrice?: number | null;
  zoneBPrice?: number | null;
  zoneCPrice?: number | null;
  zoneDPrice?: number | null;
  zoneEPrice?: number | null;
  zoneFPrice?: number | null;
  zoneGPrice?: number | null;
  zoneIPrice?: number | null;
  zoneJPrice?: number | null;
  zoneAwayPrice?: number | null;
  status?: string;
};
function requireFullDataForOnSale(d: MatchShape, ctx: z.RefinementCtx) {
  if (d.seasonPassEligible && (!d.homeTeam || !isPattaniHomeTeam(d.homeTeam))) {
    ctx.addIssue({
      code: "custom",
      path: ["seasonPassEligible"],
      message: "เปิดสิทธิ์บัตรรายปีได้เฉพาะเมื่อทีมเหย้าเป็น Pattani FC เท่านั้น",
    });
  }
  if (d.status !== "ON_SALE") return;
  const missing: string[] = [];
  if (!d.venue) missing.push("สนาม");
  if (!d.kickoffAt) missing.push("วันเวลาแข่ง");
  if (d.totalSeats == null) missing.push("จำนวนที่นั่ง");
  if ([
    d.zoneASeats,
    d.zoneBSeats,
    d.zoneCSeats,
    d.zoneDSeats,
    d.zoneESeats,
    d.zoneFSeats,
    d.zoneGSeats,
    d.zoneISeats,
    d.zoneJSeats,
    d.zoneAwaySeats,
  ].some((capacity) => capacity == null)) {
    missing.push("จำนวนที่นั่งแยกทุกโซน");
  }
  const zones = [
    [d.zoneASeats, d.zoneAPrice],
    [d.zoneBSeats, d.zoneBPrice],
    [d.zoneCSeats, d.zoneCPrice],
    [d.zoneDSeats, d.zoneDPrice],
    [d.zoneESeats, d.zoneEPrice],
    [d.zoneFSeats, d.zoneFPrice],
    [d.zoneGSeats, d.zoneGPrice],
    [d.zoneISeats, d.zoneIPrice],
    [d.zoneJSeats, d.zoneJPrice],
    [d.zoneAwaySeats, d.zoneAwayPrice],
  ];
  if (zones.some(([capacity, price]) => (capacity ?? 0) > 0 && price == null)) {
    missing.push("ราคาของทุกโซนที่เปิดขาย");
  }
  if (missing.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["status"],
      message: `เปิดจองไม่ได้ ยังขาดข้อมูล: ${missing.join(", ")}`,
    });
  }
}

export const matchCreateSchema = matchBaseSchema.superRefine(
  requireFullDataForOnSale
);

export const matchUpdateSchema = matchBaseSchema
  .partial()
  .superRefine(requireFullDataForOnSale);

export const matchZoneLabelsSchema = z.array(z.object({
  code: z.string().refine(
    (value) => (STADIUM_ZONE_CODES as readonly string[]).includes(value),
    "รหัสโซนไม่ถูกต้อง",
  ),
  label: z.string().trim().min(1, "กรุณากรอกชื่อที่แสดงของโซน").max(80),
})).length(STADIUM_ZONE_CODES.length);

export const bookingCreateSchema = z.object({
  matchId: z.string().min(1),
  zone: z.string().trim().toUpperCase().regex(
    /^[A-Z0-9][A-Z0-9-]{0,19}$/,
    "รหัสโซนไม่ถูกต้อง",
  ),
  customerName: z.string().trim().min(1).max(100),
  // optional — guest booking ไม่มีอีเมล, member ใช้ session email (ใส่จาก server)
  customerEmail: z.string().trim().toLowerCase().email().max(200).nullish(),
  customerPhone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, "เบอร์โทรไม่ถูกต้อง"),
  quantity: z.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน").max(200),
    newPassword: z
      .string()
      .min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
      .max(200),
    confirmPassword: z.string().max(200),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "ยืนยันรหัสผ่านไม่ตรงกัน",
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ["newPassword"],
    message: "รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม",
  });

export type MatchCreateInput = z.infer<typeof matchCreateSchema>;
export type MatchUpdateInput = z.infer<typeof matchUpdateSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
