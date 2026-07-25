"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteResultMatch } from "@/app/actions/match-results";

export default function DeleteResultMatchButton({ matchId }: { matchId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("ยืนยันลบแมตช์นี้?")) return;
        start(async () => {
          const res = await deleteResultMatch(matchId);
          if ("error" in res) alert(res.error);
          else router.refresh();
        });
      }}
      className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "..." : "ลบ"}
    </button>
  );
}
