"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  registerStaffSeasonPass,
  type StaffSeasonPassState,
} from "@/app/actions/staff-season-passes";
import { SEASON_PASS_SHIRT_SIZES, seasonTierIncludesShirt } from "@/lib/season-pass-tiers";

type TierOption = {
  id: string;
  badge: string;
  priceBaht: number;
  availableBarcodeCount: number;
  zones: { seatZone: string; remaining: number | null }[];
};

type MemberOption = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
};

export default function StaffSeasonPassForm({
  tiers,
  vvipBarcodes,
  members,
  disabled,
}: {
  tiers: TierOption[];
  vvipBarcodes: string[];
  members: MemberOption[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<StaffSeasonPassState, FormData>(
    registerStaffSeasonPass,
    undefined,
  );
  const [tierId, setTierId] = useState(tiers[0]?.id ?? "");
  const [memberId, setMemberId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const selectedTier = useMemo(
    () => tiers.find((tier) => tier.id === tierId) ?? tiers[0],
    [tierId, tiers],
  );
  const isVvip = selectedTier?.id === "vvip-elite";
  const canDeferZone = isVvip || selectedTier?.id === "vip-advanced";
  const includesShirt = seasonTierIncludesShirt(selectedTier?.id ?? "");
  const selectedMember = useMemo(
    () => members.find((member) => member.id === memberId) ?? null,
    [memberId, members],
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setMemberId("");
      router.refresh();
    }
  }, [router, state]);

  const errorFor = (field: string) => state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
  const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:bg-slate-100";

  return (
    <form ref={formRef} action={formAction} className="space-y-5 rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
      {state && (
        <div className={`rounded-lg px-4 py-3 text-base font-medium ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {state.ok ? state.message : state.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="สมาชิกที่จองบัตร" error={errorFor("customerId")}>
          <select
            name="customerId"
            value={memberId}
            required
            disabled={disabled || pending}
            onChange={(event) => setMemberId(event.target.value)}
            className={inputClass}
          >
            <option value="" disabled>เลือกสมาชิกที่สมัครแล้ว</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.phone || "ไม่มีเบอร์"} · {member.email}
              </option>
            ))}
          </select>
          {selectedMember && (
            <span className="mt-1.5 block rounded-md bg-emerald-50 px-3 py-2 text-sm font-normal text-emerald-800">
              ระบบจะผูกบัตรกับ {selectedMember.name} ({selectedMember.email})
            </span>
          )}
        </Field>

        <Field label="แพ็กเกจ" error={errorFor("tierId")}>
          <select
            name="tierId"
            value={tierId}
            disabled={disabled || pending}
            onChange={(event) => setTierId(event.target.value)}
            className={inputClass}
          >
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.badge} · {tier.priceBaht.toLocaleString("th-TH")} บาท
              </option>
            ))}
          </select>
          {selectedTier && (
            <span className="mt-1 block text-sm text-slate-500">
              บาร์โค้ดพร้อมใช้ {selectedTier.availableBarcodeCount.toLocaleString("th-TH")} ใบ
            </span>
          )}
        </Field>

        <Field label={canDeferZone ? "โซน (ไม่บังคับ)" : "โซน"} error={errorFor("seatZone")}>
          <select key={tierId} name="seatZone" required={!canDeferZone} defaultValue="" disabled={disabled || pending} className={inputClass}>
            <option value="" disabled={!canDeferZone}>{canDeferZone ? "ยังไม่ระบุ — แก้ไขภายหลังได้" : "เลือกโซน"}</option>
            {selectedTier?.zones.map((zone) => (
              <option key={zone.seatZone} value={zone.seatZone} disabled={zone.remaining === 0}>
                {zone.seatZone}{zone.remaining == null ? "" : ` · เหลือ ${zone.remaining.toLocaleString("th-TH")}`}
              </option>
            ))}
          </select>
        </Field>

        {isVvip && (
          <>
            <Field label="บาร์โค้ด VVIP (ไม่บังคับ)" error={errorFor("barcode")}>
              <input name="barcode" list="staff-vvip-barcodes" autoComplete="off" placeholder="ยังไม่ระบุ — แก้ไขภายหลังได้" className={`${inputClass} font-mono uppercase`} />
              <datalist id="staff-vvip-barcodes">
                {vvipBarcodes.map((barcode) => <option key={barcode} value={barcode} />)}
              </datalist>
            </Field>
            <Field label="หมายเลขที่นั่ง VVIP (ไม่บังคับ)" error={errorFor("seatNumber")}>
              <input name="seatNumber" maxLength={30} placeholder="ยังไม่ระบุ — แก้ไขภายหลังได้" className={inputClass} />
            </Field>
          </>
        )}

        {includesShirt && (
          <Field label="ไซส์เสื้อ (ไม่บังคับ)" error={errorFor("shirtSize")}>
            <select key={tierId} name="shirtSize" defaultValue="" className={inputClass}>
              <option value="">ยังไม่ระบุ — แก้ไขภายหลังได้</option>
              {SEASON_PASS_SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </Field>
        )}
        <Field label="วิธีชำระเงิน" error={errorFor("paymentMethod")}>
          <select name="paymentMethod" required defaultValue="" className={inputClass}>
            <option value="" disabled>เลือกวิธีชำระเงิน</option>
            <option value="OFFLINE_CASH">เงินสด</option>
            <option value="OFFLINE_TRANSFER">โอนเงิน</option>
          </select>
        </Field>
        <Field label="เลขที่ใบเสร็จ / เลขอ้างอิง (ไม่บังคับ)" error={errorFor("offlineReceiptNo")}>
          <input name="offlineReceiptNo" maxLength={100} className={inputClass} />
        </Field>
        <Field label="หมายเหตุ (ไม่บังคับ)" error={errorFor("notes")}>
          <textarea name="notes" rows={3} maxLength={500} className={inputClass} />
        </Field>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        รายการนี้จะยืนยันสิทธิ์ทันที ตัดโควตาเดียวกับหน้าออนไลน์ และบันทึกบัญชีทีมงานผู้ทำรายการ กรุณาตรวจข้อมูลก่อนบันทึก
      </div>
      <button
        type="submit"
        disabled={disabled || pending || tiers.length === 0}
        className="rounded-lg bg-green-800 px-5 py-3 text-lg font-bold text-yellow-300 hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก..." : disabled ? "ปิดการจองทั้งหมดอยู่" : "ยืนยันการจองโดยทีมงาน"}
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-base font-semibold text-slate-800">
      {label}
      {children}
      {error && <span className="mt-1 block text-sm font-normal text-red-600">{error}</span>}
    </label>
  );
}
