// Helpers สำหรับหน้า news — รวมการ resolve cover image + validation

type MediaDoc = {
  id?: string | number;
  url?: string;
  filename?: string;
  alt?: string;
};

export type NewsDoc = {
  id: string | number;
  title: string;
  slug: string;
  summary?: string;
  publishedAt?: string;
  cover?: MediaDoc | string | null;
  coverImageUrl?: string;
  status: string;
  body?: unknown; // richText structure จาก Payload
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

/** ตรวจ slug ปลอดภัยก่อน query — กัน path traversal / SQL/Mongo injection ทางอ้อม */
export function isValidSlug(s: string): boolean {
  return SLUG_PATTERN.test(s);
}

/** เลือก cover ที่ใช้งานได้: ใช้ upload (Media) ก่อน, fallback เป็น coverImageUrl */
export function resolveCover(doc: NewsDoc): string | null {
  const c = doc.cover;
  if (c && typeof c !== "string") {
    if (c.url) return c.url;
    if (c.filename) return `/uploads/media/${c.filename}`;
  }
  if (doc.coverImageUrl && doc.coverImageUrl.startsWith("http")) {
    return doc.coverImageUrl;
  }
  return null;
}
