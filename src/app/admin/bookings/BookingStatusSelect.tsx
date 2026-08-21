"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus } from "@/app/actions/bookings";

const options = ["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"] as const;
const optionLabel: Record<(typeof options)[number], string> = {
  PENDING: "รอชำระ",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  REFUNDED: "ทำเครื่องหมายคืนเงินแล้ว",
};

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
}: {
  bookingId: string;
  currentStatus: string;
}) {
  const [pending, start] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const router = useRouter();

  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  return (
    <select
      disabled={pending}
      value={selectedStatus}
      onChange={(e) => {
        const next = e.target.value as (typeof options)[number];
        if (next === currentStatus) return;
        setSelectedStatus(next);
        start(async () => {
          const res = await updateBookingStatus(bookingId, next);
          if ("error" in res) {
            setSelectedStatus(currentStatus);
            alert(res.error);
          } else {
            router.refresh();
          }
        });
      }}
      className="rounded border px-1 py-0.5 text-xs"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {optionLabel[s]}
        </option>
      ))}
    </select>
  );
}
