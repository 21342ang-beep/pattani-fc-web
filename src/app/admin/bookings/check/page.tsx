import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import CheckForm from "./CheckForm";

export const metadata = { title: "ตรวจสอบการจอง — Pattani FC Admin" };

export default async function CheckBookingPage() {
  await verifyPermission("BOOKINGS");

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <header>
        <Link
          href="/admin/bookings"
          className="text-sm font-medium text-green-800 hover:underline"
        >
          ← กลับไปหน้าการจอง
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-green-900">ตรวจสอบการจอง</h1>
        <p className="text-sm text-slate-600">
          กรอกรหัสการจองเพื่อดูสถานะและรายละเอียด
        </p>
      </header>
      <CheckForm />
    </div>
  );
}
