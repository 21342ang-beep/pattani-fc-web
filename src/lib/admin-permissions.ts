import type { Permission } from "@prisma/client";
import { ADMIN_SECTIONS, type AdminSection } from "./admin-sections";

// สิทธิ์ของการ์ดพิเศษบนแดชบอร์ด แยกจากหมวดหลักเพื่อกำหนดผู้เข้าถึงได้อิสระ
export const ADMIN_EXTRA_PERMISSION_CARDS: readonly AdminSection[] = [
  {
    permission: "ACCOUNT",
    label: "บัญชี",
    description: "ดูข้อมูลบัญชีและช่องทางการชำระเงิน",
    icon: "🏦",
    href: "/admin/account",
  },
  {
    permission: "MEMBER_DATA",
    label: "ข้อมูลผู้ใช้",
    description: "ดูข้อมูลผู้ที่สมัครสมาชิกกับสโมสร",
    icon: "👤",
    href: "/admin/members",
  },
  {
    permission: "MATCH_RESULTS",
    label: "รายงานผลการแข่งขัน",
    description: "บันทึกและแก้ไขผลการแข่งขัน",
    icon: "🏁",
    href: "/admin/results",
  },
  {
    permission: "BARCODE_MANAGEMENT",
    label: "จัดการบาร์โค้ด",
    description: "สร้าง ดาวน์โหลด และจัดการบาร์โค้ดบัตรรายปี",
    icon: "▥",
    href: "/admin/barcodes",
  },
] as const;

export const ADMIN_PERMISSION_CARDS: readonly AdminSection[] = [
  ...ADMIN_SECTIONS,
  ...ADMIN_EXTRA_PERMISSION_CARDS,
];

export const ALL_PERMISSIONS: readonly Permission[] =
  ADMIN_PERMISSION_CARDS.map((section) => section.permission);

export const ADMIN_PERMISSION_LABELS: Partial<Record<Permission, string>> =
  Object.fromEntries(
    ADMIN_PERMISSION_CARDS.map((section) => [section.permission, section.label]),
  );
