import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

// ป้องกัน file upload ที่ไม่ปลอดภัย:
// - ตรวจขนาด, MIME, ขนาดไฟล์
// - ตรวจ magic bytes ของจริง (กัน MIME spoofing)
// - generate UUID filename → กัน path traversal & overwriting
// - whitelist เฉพาะรูป raster (ไม่รับ SVG เพื่อกัน XSS)

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp"] as const;
type AllowedExt = (typeof ALLOWED_EXT)[number];

const MAGIC: Record<AllowedExt, (bytes: Uint8Array) => boolean> = {
  png: (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  jpg: (b) =>
    b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) =>
    b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) =>
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
};

export class UploadError extends Error {}

function detectExtByMagic(bytes: Uint8Array): AllowedExt | null {
  if (MAGIC.png(bytes)) return "png";
  if (MAGIC.webp(bytes)) return "webp";
  if (MAGIC.jpg(bytes)) return "jpg";
  return null;
}

// เก็บไฟล์โล้โก้ทีม → คืน path ที่ปลอดภัย ใช้แสดงได้เลย
export async function saveTeamLogo(file: File): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("ไฟล์ว่าง");
  if (file.size > MAX_BYTES) throw new UploadError("ไฟล์ใหญ่เกิน 2MB");

  const buf = new Uint8Array(await file.arrayBuffer());

  // ตรวจ magic bytes (กัน MIME header spoofing)
  const ext = detectExtByMagic(buf);
  if (!ext) {
    throw new UploadError("รองรับเฉพาะไฟล์ PNG, JPG, WEBP");
  }

  // ใช้ UUID เป็นชื่อไฟล์ ไม่เอาชื่อจากผู้ใช้เลย → กัน path traversal
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "matches");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  return `/uploads/matches/${filename}`;
}

// ลบไฟล์โล้โก้เก่าเมื่อมีการอัปโหลดทับ
// path ต้องตรง pattern เท่านั้น → กัน path traversal ผ่าน DB
const LOGO_PATH_RE = /^\/uploads\/matches\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/;

export async function deleteTeamLogo(logoPath: string | null | undefined): Promise<void> {
  if (!logoPath || !LOGO_PATH_RE.test(logoPath)) return;
  const filename = path.basename(logoPath); // กัน traversal ขั้นสุดท้าย
  const full = path.join(process.cwd(), "public", "uploads", "matches", filename);
  try {
    await unlink(full);
  } catch {
    // ไฟล์อาจถูกลบไปแล้ว — ไม่ throw เพื่อไม่ block flow
  }
}

export function isValidLogoPath(p: string | null | undefined): p is string {
  return typeof p === "string" && LOGO_PATH_RE.test(p);
}
