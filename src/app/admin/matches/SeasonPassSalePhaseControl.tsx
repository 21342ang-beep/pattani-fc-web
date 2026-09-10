"use client";

import { Power } from "lucide-react";
import { useState, useTransition } from "react";
import { setSeasonPassTierSaleOpen } from "@/app/actions/ticket-purchase-settings";
import type { PublicSeasonPassTierId } from "@/lib/season-pass-sale-policy";

const PUBLIC_PACKAGES: { id: PublicSeasonPassTierId; label: string }[] = [
  { id: "vip-advanced", label: "แพ็กเกจ 2,500 บาท" },
  { id: "premium", label: "แพ็กเกจ 2,000 บาท" },
  { id: "gold", label: "แพ็กเกจ 1,500 บาท" },
];

export default function SeasonPassSalePhaseControl({
  initialOpenTierIds,
  stats,
}: {
  initialOpenTierIds: PublicSeasonPassTierId[];
  stats: {
    total: number;
    staffBooked: number;
    onlineBooked: number;
    sponsorBooked: number;
    remaining: number;
  };
}) {
  const [openTierIds, setOpenTierIds] = useState(() => new Set(initialOpenTierIds));
  const [error, setError] = useState("");
  const [pendingTierId, setPendingTierId] = useState<PublicSeasonPassTierId | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(tierId: PublicSeasonPassTierId, label: string) {
    const nextOpen = !openTierIds.has(tierId);
    const message = nextOpen
      ? `ยืนยันเปิดขาย ${label} ให้ผู้ใช้ทั่วไป?\n\nทีมงานจองแล้ว ${stats.staffBooked.toLocaleString("th-TH")} ใบ\nลงทะเบียนสปอนเซอร์แล้ว ${stats.sponsorBooked.toLocaleString("th-TH")} ใบ\nคงเหลือรวมสำหรับขายประมาณ ${stats.remaining.toLocaleString("th-TH")} ใบ`
      : `ยืนยันปิดขาย ${label}?\n\nรายการจองและการชำระเงินเดิมจะไม่ถูกเปลี่ยนแปลง`;
    if (!window.confirm(message)) return;

    setError("");
    setPendingTierId(tierId);
    startTransition(async () => {
      try {
        const result = await setSeasonPassTierSaleOpen(tierId, nextOpen);
        if (result.ok) {
          setOpenTierIds((current) => {
            const next = new Set(current);
            if (nextOpen) next.add(tierId);
            else next.delete(tierId);
            return next;
          });
        } else {
          setError(result.error);
        }
      } catch {
        setError("เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        setPendingTierId(null);
      }
    });
  }

  return (
    <div className="mt-5 border-t border-black/10 pt-4">
      <p className="mb-3 text-xs font-semibold text-slate-600">
        เปิดขาย {openTierIds.size} จาก {PUBLIC_PACKAGES.length} แพ็กเกจ
      </p>
      <div className="space-y-3">
        {PUBLIC_PACKAGES.map((tier) => {
          const isOpen = openTierIds.has(tier.id);
          return (
            <div key={tier.id} className="flex items-center justify-between gap-3">
              <span className={`inline-flex items-center gap-2 text-sm font-bold ${isOpen ? "text-emerald-700" : "text-slate-500"}`}>
                <Power className="size-4" aria-hidden="true" />
                <span>
                  {tier.label}
                  <span className="ml-1 text-xs font-medium">({isOpen ? "เปิด" : "ปิด"})</span>
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isOpen}
                aria-label={`${isOpen ? "ปิด" : "เปิด"}การขาย${tier.label}`}
                disabled={pending}
                onClick={() => toggle(tier.id, tier.label)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:cursor-wait disabled:opacity-60 ${isOpen ? "bg-emerald-600" : "bg-slate-400"}`}
              >
                <span className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform ${isOpen ? "translate-x-6" : "translate-x-0"}`} />
                <span className="sr-only">{pendingTierId === tier.id ? "กำลังบันทึก" : tier.label}</span>
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
