import Link from "next/link";
import MatchForm from "../MatchForm";
import { createMatch } from "@/app/actions/matches";
import { verifyPermission } from "@/lib/dal";

export const metadata = { title: "เพิ่มแมตช์ — Admin" };

export default async function NewMatchPage() {
  await verifyPermission("MATCHES");
  return (
    <div className="max-w-3xl">
      <Link href="/admin/matches" className="text-sm text-slate-500 hover:text-slate-900">
        ← กลับ
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-bold">เพิ่มแมตช์ใหม่</h1>
      <MatchForm action={createMatch} submitLabel="บันทึก" />
    </div>
  );
}
