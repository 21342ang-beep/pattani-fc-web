import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import EditMemberForm from "./EditMemberForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขสมาชิก — Pattani FC Admin" };

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await verifyPermission("MEMBER_DATA");
  const { id } = await params;
  if (!/^[a-z0-9]+$/i.test(id)) notFound();

  const member = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      passwordHash: true,
    },
  });
  if (!member) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/members"
          className="text-sm font-semibold text-green-800 hover:underline"
        >
          ← กลับไปข้อมูลสมาชิก
        </Link>
        <h1 className="mt-3 text-3xl font-black text-green-900 md:text-4xl">
          แก้ไขสมาชิก
        </h1>
        <p className="mt-1 text-base text-slate-600">{member.name}</p>
      </div>

      <EditMemberForm
        memberId={member.id}
        name={member.name}
        email={member.email}
        phone={member.phone ?? ""}
        hasPassword={Boolean(member.passwordHash)}
        canResetPassword={actor.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
