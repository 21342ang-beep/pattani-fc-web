"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMatch } from "@/app/actions/matches";

export default function DeleteMatchButton({ matchId }: { matchId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("ยืนยันลบแมตช์นี้?")) return;
        start(async () => {
          const res = await deleteMatch(matchId);
          if ("error" in res) alert(res.error);
          else router.refresh();
        });
      }}
      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "..." : "ลบ"}
    </button>
  );
}
