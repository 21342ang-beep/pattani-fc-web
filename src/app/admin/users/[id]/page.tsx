import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import EditUserForm from "./EditUserForm";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขผู้ดูแล — Pattani FC Admin" };

export default async function EditUserPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifyAdmin();
  if (session.role !== "SUPER_ADMIN") redirect("/admin");

  const { id } = await props.params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
    },
  });
  if (!target) notFound();

  const isSelf = target.id === session.userId;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← กลับ
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-green-900">
          แก้ไขผู้ดูแล
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {target.email}
          {isSelf && (
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              บัญชีของคุณ
            </span>
          )}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-green-900">
          Role และสิทธิ์
        </h2>
        <EditUserForm
          userId={target.id}
          defaultRole={target.role}
          defaultName={target.name}
          defaultPermissions={target.permissions}
          isSelf={isSelf}
        />
      </div>

      <ResetPasswordForm userId={target.id} />
    </div>
  );
}
