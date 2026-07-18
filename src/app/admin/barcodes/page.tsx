import Link from "next/link";
import { verifyPermission } from "@/lib/dal";

export const dynamic = "force-dynamic";
export const metadata = { title: "จัดการบาร์โค้ด — Admin" };

export default async function BarcodeManagementPage() {
  await verifyPermission("BARCODE_MANAGEMENT");

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-900">จัดการบาร์โค้ด</h1>
        <p className="mt-1 text-sm text-slate-600">เลือกงานที่ต้องการดำเนินการ</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/gate-check"
          className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-2xl group-hover:bg-green-100">
            ▥
          </div>
          <h2 className="mt-4 text-base font-bold text-green-900">รันบาร์โค้ด</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            สแกนบาร์โค้ดเพื่อเช็กผู้เข้างาน
          </p>
        </Link>
        <Link
          href="/admin/barcodes/create"
          className="group rounded-xl border border-green-300 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-400 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-2xl group-hover:bg-green-200">
            +
          </div>
          <h2 className="mt-4 text-base font-bold text-green-900">สร้างบาร์โค้ด</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            สร้าง Code 128 สำหรับพิมพ์หรือดาวน์โหลด
          </p>
        </Link>
      </div>
    </div>
  );
}
