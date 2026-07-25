import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { updateResultMatch, type ResultMatchFormState } from "@/app/actions/match-results";
import ResultMatchForm from "../ResultMatchForm";

export const metadata = { title: "แก้ไขแมตช์ — Admin" };
export const dynamic = "force-dynamic";

export default async function EditResultMatchPage(props: {
  params: Promise<{ id: string }>;
}) {
  await verifyPermission("MATCH_RESULTS");
  const { id } = await props.params;
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) notFound();
  const competitionType = match.competitionType === "CUP" ? "CUP" : "LEAGUE";

  const action = async (prev: ResultMatchFormState, fd: FormData) => {
    "use server";
    return updateResultMatch(id, prev, fd);
  };

  return (
    <div className="max-w-xl">
      <Link href={`/admin/results?competition=${competitionType}`} className="text-sm text-slate-500 hover:text-slate-900">
        ← กลับหน้ารายงานผล
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-bold">แก้ไขแมตช์</h1>
      <ResultMatchForm
        action={action}
        competitionType={competitionType}
        initial={match}
        submitLabel="บันทึกการแก้ไข"
      />
    </div>
  );
}
