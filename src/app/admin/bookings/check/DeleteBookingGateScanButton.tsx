"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBookingGateScan } from "@/app/actions/lookupBooking";

export default function DeleteBookingGateScanButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("ลบข้อมูลสแกนรายการนี้เพื่อทดสอบใช่หรือไม่?")) return;
        startTransition(async () => {
          const result = await deleteBookingGateScan(scanId);
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
