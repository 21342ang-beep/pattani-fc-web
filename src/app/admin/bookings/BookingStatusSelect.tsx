"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus } from "@/app/actions/bookings";

const options = ["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"] as const;

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
}: {
  bookingId: string;
  currentStatus: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <select
      disabled={pending}
      defaultValue={currentStatus}
      onChange={(e) => {
        const next = e.target.value as (typeof options)[number];
        if (next === currentStatus) return;
        start(async () => {
          const res = await updateBookingStatus(bookingId, next);
          if ("error" in res) alert(res.error);
          else router.refresh();
        });
      }}
      className="rounded border px-1 py-0.5 text-xs"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
