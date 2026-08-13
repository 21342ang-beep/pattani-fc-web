"use client";

import type { SeasonPassSalePhase } from "@prisma/client";
import { Power } from "lucide-react";
import { useState, useTransition } from "react";
import { setSeasonPassSalePhase } from "@/app/actions/ticket-purchase-settings";

export default function SeasonPassSalePhaseControl({
  initialPhase,
  stats,
}: {
  initialPhase: SeasonPassSalePhase;
  stats: { total: number; staffBooked: number; onlineBooked: number; remaining: number };
}) {
  const [isOpen, setIsOpen] = useState(initialPhase === "PUBLIC_OPEN");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    const nextOpen = !isOpen;
    const message = nextOpen
      ? `ยืนยันเปิดจองบัตรรายปีให้ผู้ใช้ทั่วไป?\n\nทีมงานจองแล้ว ${stats.staffBooked.toLocaleString("th-TH")} ใบ\nคงเหลือประมาณ ${stats.remaining.toLocaleString("th-TH")} ใบ`
      : "ยืนยันปิดจองบัตรรายปีสำหรับผู้ใช้ทั่วไป?\n\nทีมงานยังจองแพ็กเกจ 4,000 บาทผ่านหลังบ้านได้";
    if (!window.confirm(message)) return;

    setError("");
    startTransition(async () => {
      try {
        const result = await setSeasonPassSalePhase(nextOpen ? "PUBLIC_OPEN" : "CLOSED");
        if (result.ok) setIsOpen(nextOpen);
        else setError(result.error);
      } catch {
        setError("เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  return (
    <div className="mt-5 border-t border-black/10 pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-2 text-sm font-bold ${isOpen ? "text-emerald-700" : "text-slate-500"}`}>
          <Power className="size-4" aria-hidden="true" />
          {isOpen ? "เปิดจองอยู่" : "ปิดจองอยู่"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOpen}
          aria-label={isOpen ? "ปิดการจองบัตรรายปี" : "เปิดการจองบัตรรายปี"}
          disabled={pending}
          onClick={toggle}
          className={`relative h-8 w-14 rounded-full transition disabled:cursor-wait disabled:opacity-60 ${isOpen ? "bg-emerald-600" : "bg-slate-400"}`}
        >
          <span className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform ${isOpen ? "translate-x-6" : "translate-x-0"}`} />
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
