import Link from "next/link";
import { verifyPermission } from "@/lib/dal";
import { createResultMatch } from "@/app/actions/match-results";
import ResultMatchForm from "../ResultMatchForm";

export const metadata = { title: "เพิ่มแมตช์ — Admin" };

export default async function NewResultMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  await verifyPermission("MATCH_RESULTS");
  const { competition } = await searchParams;
  const competitionType = competition === "CUP" ? "CUP" : "LEAGUE";
  return (
    <div className="max-w-xl">
      <Link href={`/admin/results?competition=${competitionType}`} className="text-sm text-slate-500 hover:text-slate-900">
        ← กลับหน้ารายงานผล
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-bold">เพิ่มแมตช์</h1>
      <p className="mb-6 text-sm text-slate-600">
        กรอกชื่อทีมและวันแข่ง แล้วบันทึกสกอร์ได้จากหน้ารายงานผล
      </p>
      <ResultMatchForm
        action={createResultMatch}
        competitionType={competitionType}
        submitLabel="บันทึกแมตช์"
      />
    </div>
  );
}
