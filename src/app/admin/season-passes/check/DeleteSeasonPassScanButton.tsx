"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSeasonPassScan } from "@/app/actions/gate-check";

export default function DeleteSeasonPassScanButton({ scanId }: { scanId: string }) {
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
          else router.refresh();
        });
      }}
      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "ลบ"}
    </button>
  );
}
