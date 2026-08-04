import Link from "next/link";
import { verifyAnyPermission } from "@/lib/dal";
import { getTicketPurchaseSettings } from "@/lib/ticket-purchase-settings";
import TicketPurchaseSettingsForm from "./TicketPurchaseSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตั้งค่าจำนวนตั๋ว — Admin" };

export default async function TicketPurchaseSettingsPage() {
  await verifyAnyPermission(["MATCHES", "SEASON_PASSES"]);
  const settings = await getTicketPurchaseSettings();

  return (
    <div>
      <Link href="/admin" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← กลับหน้าหลักหลังบ้าน
      </Link>
      <h1 className="mt-2 text-3xl font-black text-green-900">ตั้งค่าจำนวนตั๋วต่อคำสั่งซื้อ</h1>
      <p className="mt-2 max-w-2xl text-base text-slate-600">
        ค่านี้มีผลกับหน้าจองของลูกค้าและการตรวจสอบฝั่งเซิร์ฟเวอร์ทันที ไม่ต้องแก้โค้ดหรือ build ใหม่
      </p>
      <TicketPurchaseSettingsForm {...settings} />
    </div>
  );
}
