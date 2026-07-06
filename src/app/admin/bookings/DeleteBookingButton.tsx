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

  // เตือนเพิ่มถ้าเป็นรายการที่ confirmed/paid → กันลบผิด
  const codeHint = bookingCode.slice(0, 8);
  const warning =
    status === "CONFIRMED"
      ? `รายการนี้สถานะ "ยืนยันแล้ว" — ยืนยันลบ ${codeHint} ?\n\nลบแล้วกู้คืนไม่ได้`
      : `ยืนยันลบรายการจอง ${codeHint} ?\n\nลบแล้วกู้คืนไม่ได้`;

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
