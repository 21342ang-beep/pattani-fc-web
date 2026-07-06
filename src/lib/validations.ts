import { z } from "zod";

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
  pricePerSeat: z.number().int().nonnegative().max(100_000_00).nullish(), // สตางค์
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["SCHEDULED", "ON_SALE", "SOLD_OUT", "CANCELLED", "FINISHED"]).optional(),
});

// guard: ON_SALE ต้องมี field สำคัญครบ — กันลูกค้าจองตั๋วแมตช์ที่ยังไม่มีวัน/ราคา/ที่นั่ง
type MatchShape = {
  venue?: string | null;
  kickoffAt?: Date | null;
  totalSeats?: number | null;
  pricePerSeat?: number | null;
  status?: string;
};
function requireFullDataForOnSale(d: MatchShape, ctx: z.RefinementCtx) {
  if (d.status !== "ON_SALE") return;
  const missing: string[] = [];
  if (!d.venue) missing.push("สนาม");
  if (!d.kickoffAt) missing.push("วันเวลาแข่ง");
  if (d.totalSeats == null) missing.push("จำนวนที่นั่ง");
  if (d.pricePerSeat == null) missing.push("ราคา");
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

export const bookingCreateSchema = z.object({
  matchId: z.string().min(1),
  customerName: z.string().trim().min(1).max(100),
  // optional — guest booking ไม่มีอีเมล, member ใช้ session email (ใส่จาก server)
  customerEmail: z.string().trim().toLowerCase().email().max(200).nullish(),
  customerPhone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, "เบอร์โทรไม่ถูกต้อง"),
  quantity: z.number().int().positive().max(10), // จำกัด 10 ที่นั่ง/การจอง
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
