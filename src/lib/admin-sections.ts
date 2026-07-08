import type { Permission } from "@prisma/client";

// รายการหมวดหลังบ้านทั้งหมด — single source of truth
// ใช้โดย: dashboard card grid, permission editor
export type AdminSection = {
  permission: Permission;
  label: string;
  description: string;
  icon: string;
  href: string;
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    permission: "MATCHES",
    label: "จัดการแมตช์",
    description: "สร้าง / แก้ไข / เปิด-ปิดขายแมตช์",
    icon: "⚽",
    href: "/admin/matches",
  },
  {
    permission: "BOOKINGS",
    label: "การจอง",
    description: "ยืนยันชำระเงิน & จัดการที่นั่งรายแมตช์",
    icon: "🎟️",
    href: "/admin/bookings",
  },
  {
    permission: "SEASON_PASSES",
    label: "บัตรรายปี",
    description: "อนุมัติสมาชิกซีซั่นพาส",
    icon: "🏆",
    href: "/admin/season-passes",
  },
  {
    permission: "CUSTOMERS",
    label: "ลูกค้า",
    description: "ค้นหา / จัดการบัญชีลูกค้า",
    icon: "👨‍👩‍👧",
    href: "/admin/customers",
  },
  {
    permission: "WEBSITE",
    label: "จัดการเว็บไซต์",
    description: "แก้ไขเนื้อหาหน้าเว็บสาธารณะ",
    icon: "🌐",
    href: "/admin/website",
  },
  {
    permission: "REPORTS",
    label: "รายงานยอดขาย",
    description: "สรุปยอดจอง / ยอดขายรายวัน",
    icon: "📈",
    href: "/admin/reports",
  },
  {
    permission: "FINANCE",
    label: "การเงิน",
    description: "รายรับ-รายจ่าย (Payload CMS)",
    icon: "💰",
    href: "/admin/finance",
  },
  {
    permission: "GATE_CHECK",
    label: "สแกนเข้างาน",
    description: "สแกน QR ที่ประตูสนาม (ออฟไลน์ได้)",
    icon: "📷",
    href: "/gate-check",
  },
] as const;

export const ALL_PERMISSIONS: readonly Permission[] = ADMIN_SECTIONS.map(
  (s) => s.permission,
);

export function findSection(permission: Permission): AdminSection | undefined {
  return ADMIN_SECTIONS.find((s) => s.permission === permission);
}
