"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { confirmShopPayment, type ShopOrderState } from "@/app/actions/shop";

export default function ConfirmPaidButton({
  orderCode,
  phone,
}: {
  orderCode: string;
  phone: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ShopOrderState, FormData>(
    async (prev, fd) => confirmShopPayment(prev, fd),
    undefined
  );

  useEffect(() => {
    if (state?.redirectTo) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="orderCode" value={orderCode} />
      <input type="hidden" name="phone" value={phone} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending ? "กำลังบันทึก..." : "ฉันชำระแล้ว"}
      </button>
      {state?.error && (
        <p className="mt-2 text-xs text-rose-600">{state.error}</p>
      )}
    </form>
  );
}
