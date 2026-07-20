"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAllBookings } from "@/app/actions/bookings";

export default function DeleteAllBookingsButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const confirmed = confirm(
          "ยืนยันลบข้อมูลการจองทั้งหมดเพื่อทดสอบระบบ?\n\nข้อมูลที่ลบแล้วกู้คืนไม่ได้",
        );
        if (!confirmed) return;
        start(async () => {
          const result = await deleteAllBookings();
          if ("error" in result) {
            alert(result.error);
            return;
          }
          alert(`ลบข้อมูลการจองแล้ว ${result.deleted} รายการ`);
          router.refresh();
        });
      }}
      className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "ลบการจองทั้งหมด"}
    </button>
  );
}
