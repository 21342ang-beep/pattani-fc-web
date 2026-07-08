"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SeasonPassOrderStatus } from "@prisma/client";
import { updateSeasonPassStatus } from "@/app/actions/season-passes";

export default function SeasonPassStatusSelect({
  orderId,
  current,
}: {
  orderId: string;
  current: SeasonPassOrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      disabled={pending}
      value={current}
      onChange={(e) => {
        const status = e.target.value as SeasonPassOrderStatus;
        startTransition(async () => {
          const res = await updateSeasonPassStatus(orderId, status);
          if ("error" in res) alert(res.error);
          else router.refresh();
        });
      }}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 disabled:opacity-50"
    >
      <option value="PENDING">PENDING</option>
      <option value="CONFIRMED">CONFIRMED</option>
      <option value="CANCELLED">CANCELLED</option>
      <option value="REFUNDED">REFUNDED</option>
    </select>
  );
}
