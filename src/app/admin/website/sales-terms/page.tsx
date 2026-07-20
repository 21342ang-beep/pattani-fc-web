import Link from "next/link";
import { uploadSalesTermsPdf } from "@/app/actions/legal";
import SalesTermsUploadForm from "./SalesTermsUploadForm";
import { verifyPermission } from "@/lib/dal";

export default async function SalesTermsAdminPage() {
  await verifyPermission("WEBSITE");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/website" className="text-sm text-slate-500 hover:text-slate-900">← กลับหน้าจัดการเว็บไซต์</Link>
      <div>
        <h1 className="mt-2 text-2xl font-bold text-green-900">ข้อกำหนดและเงื่อนไขการขาย</h1>
        <p className="mt-1 text-sm text-slate-600">แนบไฟล์ PDF ที่จะแสดงให้ผู้ใช้งานดาวน์โหลดจากหน้า Privacy Policy</p>
      </div>
      <SalesTermsUploadForm action={uploadSalesTermsPdf} />
      <a href="/pattani-fc-sales-terms.txt" target="_blank" rel="noopener" className="text-sm font-semibold text-green-800 hover:underline">เปิดไฟล์เริ่มต้น</a>
    </div>
  );
}
