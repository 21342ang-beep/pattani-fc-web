"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAdmin } from "@/app/actions/users";

export default function DeleteUserButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    if (!confirm(`ยืนยันลบผู้ดูแล ${email} ?\nไม่สามารถกู้คืนได้`)) return;
    startTransition(async () => {
      const res = await deleteAdmin(userId);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {pending ? "กำลังลบ..." : "ลบ"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
