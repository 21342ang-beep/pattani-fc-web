"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSeasonPassScan } from "@/app/actions/gate-check";

export default function DeleteSeasonPassScanButton({ scanId, onDeleted }: { scanId: string; onDeleted?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("ลบข้อมูลสแกนรายการนี้และคืนสิทธิ์บัตร 1 แมตช์ใช่หรือไม่?")) return;
        startTransition(async () => {
          const result = await deleteSeasonPassScan(scanId);
          if ("error" in result) alert(result.error);
          else {
            onDeleted?.();
            router.refresh();
          }
        });
      }}
      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-base font-semibold text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "ลบ"}
    </button>
  );
}
