import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import MatchForm from "../MatchForm";
import { updateMatch, type MatchFormState } from "@/app/actions/matches";

export const metadata = { title: "แก้ไขแมตช์ — Admin" };
export const dynamic = "force-dynamic";

export default async function EditMatchPage(props: { params: Promise<{ id: string }> }) {
  await verifyPermission("MATCHES");
  const { id } = await props.params;
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) notFound();

  const action = async (prev: MatchFormState, fd: FormData) => {
    "use server";
    return updateMatch(id, prev, fd);
  };

  return (
    <div className="max-w-3xl">
      <Link href="/admin/matches" className="text-sm text-slate-500 hover:text-slate-900">
        ← กลับ
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-bold">แก้ไขแมตช์</h1>
      <MatchForm action={action} initial={match} submitLabel="บันทึกการแก้ไข" />
    </div>
  );
}
