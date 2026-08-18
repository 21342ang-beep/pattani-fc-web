"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBooking } from "@/app/actions/bookings";

export default function DeleteBookingButton({
  bookingId,
  bookingCode,
  status,
}: {
  bookingId: string;
  bookingCode: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const codeHint = bookingCode.slice(0, 8);
  if (status !== "CANCELLED") {
    return <span className="text-xs text-slate-400">เก็บเป็นหลักฐาน</span>;
  }
  const warning = `ยืนยันลบรายการที่ยกเลิกแล้ว ${codeHint} ?\n\nประวัติผู้ดำเนินการจะยังถูกเก็บใน audit log`;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(warning)) return;
        start(async () => {
          const res = await deleteBooking(bookingId);
          if ("error" in res) alert(res.error);
          else router.refresh();
        });
      }}
      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
      aria-label={`ลบรายการจอง ${codeHint}`}
    >
      {pending ? "..." : "ลบ"}
    </button>
  );
}
