"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSeasonPassOrder } from "@/app/actions/season-passes";

export default function DeleteSeasonPassButton({
  orderId,
  passCode,
}: {
  orderId: string;
  passCode: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`ยืนยันลบออเดอร์ ${passCode}?`)) return;
        startTransition(async () => {
          const res = await deleteSeasonPassOrder(orderId);
          if ("error" in res) alert(res.error);
          else router.refresh();
        });
      }}
      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "ลบ"}
    </button>
  );
}
