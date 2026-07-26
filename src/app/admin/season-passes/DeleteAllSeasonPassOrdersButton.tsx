"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAllSeasonPassOrders } from "@/app/actions/season-passes";

export default function DeleteAllSeasonPassOrdersButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`ยืนยันลบการจองบัตรรายปีทั้งหมด ${count} รายการ? การดำเนินการนี้จะล้างประวัติการสแกนและคืนบาร์โค้ดเพื่อใช้ทดสอบการจองใหม่`)) return;
        startTransition(async () => {
          const result = await deleteAllSeasonPassOrders();
          if ("error" in result) alert(result.error);
          else router.refresh();
        });
      }}
      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "ลบการจองทั้งหมด"}
    </button>
  );
}
