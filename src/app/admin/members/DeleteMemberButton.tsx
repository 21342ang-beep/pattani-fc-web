"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMember } from "@/app/actions/member-admin";

export default function DeleteMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`ยืนยันลบสมาชิก ${memberName}?\n\nลบได้เฉพาะบัญชีที่ไม่เคยมีประวัติการจองหรือตั๋ว และไม่สามารถกู้คืนได้`)) return;
        startTransition(async () => {
          const result = await deleteMember(memberId);
          if ("error" in result) alert(result.error);
          else router.refresh();
        });
      }}
      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "ลบ"}
    </button>
  );
}
