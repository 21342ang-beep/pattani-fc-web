"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSeasonPassScansByTier } from "@/app/actions/gate-check";

export default function DeleteAllSeasonPassScansButton({
  tierId,
  tierBadge,
  onDeleted,
}: {
  tierId: string;
  tierBadge: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`ลบประวัติการสแกนทั้งหมดของแพ็กเกจ ${tierBadge} ทุกแมตช์และทุกโซน พร้อมคืนสิทธิ์ให้บัตรในแพ็กเกจนี้ เพื่อทดสอบใหม่ใช่หรือไม่?`)) return;
        startTransition(async () => {
          const result = await deleteSeasonPassScansByTier(tierId);
          if ("error" in result) alert(result.error);
          else {
            alert(`ลบรายการสแกน ${result.deleted.toLocaleString("th-TH")} รายการแล้ว`);
            onDeleted?.();
            router.refresh();
          }
        });
      }}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-base font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 md:text-lg"
    >
      <Trash2 className="size-5" />
      {pending ? "กำลังลบการสแกนทั้งหมด..." : "ลบทั้งแพ็กเกจ · ทุกแมตช์/ทุกโซน"}
    </button>
  );
}
