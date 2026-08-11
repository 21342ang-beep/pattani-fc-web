"use client";

import type { SeasonPassSalePhase } from "@prisma/client";
import { LockKeyhole, Power, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setSeasonPassSalePhase } from "@/app/actions/ticket-purchase-settings";

const phaseDetails: Record<SeasonPassSalePhase, { label: string; className: string }> = {
  STAFF_ONLY: { label: "รอบทีมงาน", className: "bg-amber-100 text-amber-800" },
  PUBLIC_OPEN: { label: "เปิดจองทั่วไป", className: "bg-emerald-100 text-emerald-700" },
  CLOSED: { label: "ปิดการจองทั้งหมด", className: "bg-red-100 text-red-700" },
};

export default function SeasonPassSalePhaseControl({
  initialPhase,
  stats,
  canBookForCustomer,
}: {
  initialPhase: SeasonPassSalePhase;
  stats: { total: number; staffBooked: number; onlineBooked: number; remaining: number };
  canBookForCustomer: boolean;
}) {
  const [phase, setPhase] = useState(initialPhase);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function changePhase(nextPhase: SeasonPassSalePhase) {
    if (nextPhase === phase) return;
    const message = nextPhase === "PUBLIC_OPEN"
      ? `ยืนยันเปิดจองบัตรรายปีให้ผู้ใช้ทั่วไป?\n\nทีมงานจองแล้ว ${stats.staffBooked.toLocaleString("th-TH")} ใบ\nคงเหลือประมาณ ${stats.remaining.toLocaleString("th-TH")} ใบ`
      : nextPhase === "STAFF_ONLY"
        ? "ยืนยันเปลี่ยนเป็นรอบทีมงาน?\n\nลูกค้าทั่วไปจะสร้างรายการจองใหม่ไม่ได้ แต่ทีมงานยังจองผ่านหลังบ้านได้"
        : "ยืนยันปิดการจองบัตรรายปีทั้งหมด?\n\nทั้งลูกค้าทั่วไปและทีมงานจะสร้างรายการจองใหม่ไม่ได้";
    if (!window.confirm(message)) return;

    setError("");
    startTransition(async () => {
      try {
        const result = await setSeasonPassSalePhase(nextPhase);
        if (result.ok) {
          setPhase(nextPhase);
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError("เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  return (
    <div className="mt-5 border-t border-black/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${phaseDetails[phase].className}`}>
          <Power className="size-4" aria-hidden="true" />
          {phaseDetails[phase].label}
        </span>
        {canBookForCustomer && (
          <Link
            href="/admin/season-passes/staff"
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-800 px-3 py-2 text-sm font-bold text-yellow-300 hover:bg-green-900"
          >
            <Users className="size-4" /> จองให้ลูกค้า
          </Link>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        <Stat label="โควตาขาย" value={stats.total} />
        <Stat label="ทีมงานจอง" value={stats.staffBooked} />
        <Stat label="ออนไลน์" value={stats.onlineBooked} />
        <Stat label="คงเหลือ" value={stats.remaining} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <PhaseButton
          active={phase === "STAFF_ONLY"}
          disabled={pending}
          onClick={() => changePhase("STAFF_ONLY")}
          label="รอบทีมงาน"
          tone="amber"
        />
        <PhaseButton
          active={phase === "PUBLIC_OPEN"}
          disabled={pending}
          onClick={() => changePhase("PUBLIC_OPEN")}
          label="เปิดทั่วไป"
          tone="green"
        />
        <PhaseButton
          active={phase === "CLOSED"}
          disabled={pending}
          onClick={() => changePhase("CLOSED")}
          label="ปิดทั้งหมด"
          tone="red"
        />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
        ระบบตรวจสถานะซ้ำฝั่งเซิร์ฟเวอร์ก่อนสร้างออเดอร์ทุกครั้ง
      </p>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white/70 px-2 py-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-black text-slate-900">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

function PhaseButton({
  active,
  disabled,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  tone: "amber" | "green" | "red";
}) {
  const activeClass = {
    amber: "border-amber-500 bg-amber-100 text-amber-900",
    green: "border-emerald-600 bg-emerald-100 text-emerald-800",
    red: "border-red-500 bg-red-100 text-red-800",
  }[tone];
  return (
    <button
      type="button"
      disabled={disabled || active}
      onClick={onClick}
      className={`rounded-lg border px-2 py-2 text-sm font-bold transition disabled:cursor-default ${active ? activeClass : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"}`}
    >
      {active ? `✓ ${label}` : label}
    </button>
  );
}
