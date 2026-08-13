"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSeasonPassOrder, type EditSeasonPassState } from "@/app/actions/season-passes";
import { SEASON_PASS_SHIRT_SIZES, seasonTierIncludesShirt } from "@/lib/season-pass-tiers";

type EditableOrder = {
  id: string;
  tierId: string;
  passCode: string;
  barcode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  seatZone: string;
  seatNumber: string;
  shirtSize: string;
  deliveryMethod: "SHIPPING" | "PICKUP";
  shipAddress: string;
  shipCity: string;
  shipProvince: string;
  shipPostalCode: string;
  shipNote: string;
  pickupLocation: string;
  paymentMethod: string;
  offlineReceiptNo: string;
  notes: string;
  salesChannel: "ONLINE" | "OFFLINE" | "INTERNAL";
};

type MemberOption = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
};

const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 disabled:bg-slate-100";

export default function EditSeasonPassForm({
  order,
  tierBadge,
  zones,
  vvipBarcodes,
  members,
  backHref,
}: {
  order: EditableOrder;
  tierBadge: string;
  zones: string[];
  vvipBarcodes: string[];
  members: MemberOption[];
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState<EditSeasonPassState, FormData>(updateSeasonPassOrder, undefined);
  const router = useRouter();
  const [customerId, setCustomerId] = useState(order.customerId);
  const selectedMember = useMemo(
    () => members.find((member) => member.id === customerId) ?? null,
    [customerId, members],
  );

  useEffect(() => {
    if (state?.ok) router.push(backHref);
  }, [backHref, router, state]);

  const errorFor = (field: string) => state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
  const isOfflineVvip = order.tierId === "vvip-elite" && order.salesChannel === "OFFLINE";
  const canDeferStaffZone = ["vvip-elite", "vip-advanced"].includes(order.tierId) && order.salesChannel === "OFFLINE";
  const displayPassCode = order.passCode.startsWith("PENDING-") ? "รอระบบผูกบาร์โค้ด" : order.passCode;
  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
      <input type="hidden" name="orderId" value={order.id} />
      {state && !state.ok && <div className="rounded-lg bg-red-50 px-4 py-3 text-base font-medium text-red-700">{state.error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="แพ็กเกจ">
          <input value={`${tierBadge} · ${displayPassCode}`} disabled className={`${inputClass} font-mono`} />
        </Field>
        <Field label={canDeferStaffZone ? "โซน (ไม่บังคับ)" : "โซน"} error={errorFor("seatZone")}>
          <select name="seatZone" defaultValue={order.seatZone} required={!canDeferStaffZone} className={inputClass}>
            {canDeferStaffZone && <option value="">ยังไม่ระบุ — แก้ไขภายหลังได้</option>}
            {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </Field>
        {isOfflineVvip && (
          <Field label="บาร์โค้ด VVIP (ไม่บังคับ)" error={errorFor("barcode")}>
            <input
              name="barcode"
              list={order.barcode ? undefined : "edit-vvip-barcodes"}
              defaultValue={order.barcode}
              readOnly={Boolean(order.barcode)}
              autoComplete="off"
              placeholder="ยังไม่ระบุ — แก้ไขภายหลังได้"
              className={`${inputClass} font-mono uppercase`}
            />
            {!order.barcode && (
              <datalist id="edit-vvip-barcodes">
                {vvipBarcodes.map((barcode) => <option key={barcode} value={barcode} />)}
              </datalist>
            )}
          </Field>
        )}
        {order.salesChannel === "OFFLINE" ? (
          <Field label="สมาชิกที่เป็นเจ้าของบัตร" error={errorFor("customerId")}>
            <select
              name="customerId"
              value={customerId}
              required
              onChange={(event) => setCustomerId(event.target.value)}
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
                บัตรจะเชื่อมกับ {selectedMember.name} ({selectedMember.email})
              </span>
            )}
          </Field>
        ) : (
          <input type="hidden" name="customerId" value={order.customerId} />
        )}
        {order.salesChannel === "OFFLINE" ? (
          <>
            <input type="hidden" name="customerName" value={selectedMember?.name ?? order.customerName} />
            <input type="hidden" name="customerPhone" value={selectedMember?.phone ?? order.customerPhone} />
            <input type="hidden" name="customerEmail" value={selectedMember?.email ?? order.customerEmail} />
          </>
        ) : (
          <>
            <Field label="ชื่อ-สกุลลูกค้า" error={errorFor("customerName")}>
              <input name="customerName" defaultValue={order.customerName} required minLength={2} maxLength={100} className={inputClass} />
            </Field>
            <Field label="เบอร์โทรศัพท์" error={errorFor("customerPhone")}>
              <input name="customerPhone" type="tel" defaultValue={order.customerPhone} required className={inputClass} />
            </Field>
            <Field label="อีเมล (ไม่บังคับ)" error={errorFor("customerEmail")}>
              <input name="customerEmail" type="email" defaultValue={order.customerEmail} maxLength={200} className={inputClass} />
            </Field>
          </>
        )}
        {seasonTierIncludesShirt(order.tierId) ? (
          <Field label="ไซส์เสื้อ (ไม่บังคับ)" error={errorFor("shirtSize")}>
            <select name="shirtSize" defaultValue={order.shirtSize} className={inputClass}>
              <option value="">ยังไม่ระบุ</option>
              {SEASON_PASS_SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="shirtSize" value="" />
        )}
        <Field label={order.tierId === "vvip-elite" && !isOfflineVvip ? "หมายเลขที่นั่ง VVIP" : "หมายเลขที่นั่ง (ไม่บังคับ)"} error={errorFor("seatNumber")}>
          <input name="seatNumber" defaultValue={order.seatNumber} required={order.tierId === "vvip-elite" && !isOfflineVvip} maxLength={30} className={`${inputClass} uppercase`} />
        </Field>
        <Field label="วิธีรับบัตร" error={errorFor("deliveryMethod")}>
          <input type="hidden" name="deliveryMethod" value={order.deliveryMethod} />
          <input value={order.deliveryMethod === "SHIPPING" ? "ส่งพัสดุ" : "รับด้วยตัวเอง"} disabled className={inputClass} />
        </Field>

        {order.deliveryMethod === "SHIPPING" ? (
          <>
            <Field label="ที่อยู่จัดส่ง" error={errorFor("shipAddress")}><textarea name="shipAddress" defaultValue={order.shipAddress} rows={3} required className={inputClass} /></Field>
            <Field label="อำเภอ/เขต" error={errorFor("shipCity")}><input name="shipCity" defaultValue={order.shipCity} required className={inputClass} /></Field>
            <Field label="จังหวัด" error={errorFor("shipProvince")}><input name="shipProvince" defaultValue={order.shipProvince} required className={inputClass} /></Field>
            <Field label="รหัสไปรษณีย์" error={errorFor("shipPostalCode")}><input name="shipPostalCode" inputMode="numeric" defaultValue={order.shipPostalCode} required pattern="\d{5}" className={inputClass} /></Field>
            <Field label="หมายเหตุจัดส่ง (ไม่บังคับ)" error={errorFor("shipNote")}><input name="shipNote" defaultValue={order.shipNote} maxLength={300} className={inputClass} /></Field>
          </>
        ) : (
          <Field label="จุดรับบัตร" error={errorFor("pickupLocation")}>
            <input name="pickupLocation" defaultValue={order.pickupLocation} required maxLength={200} className={inputClass} />
          </Field>
        )}

        {order.salesChannel === "OFFLINE" ? (
          <>
            <Field label="วิธีชำระเงิน">
              <select name="paymentMethod" defaultValue={order.paymentMethod} className={inputClass}>
                <option value="OFFLINE_CASH">เงินสด</option>
                <option value="OFFLINE_TRANSFER">โอนเงิน</option>
              </select>
            </Field>
            <Field label="เลขที่ใบเสร็จ / เลขอ้างอิง (ไม่บังคับ)"><input name="offlineReceiptNo" defaultValue={order.offlineReceiptNo} maxLength={100} className={inputClass} /></Field>
          </>
        ) : (
          <input type="hidden" name="paymentMethod" value={order.paymentMethod} />
        )}
        <Field label="หมายเหตุ (ไม่บังคับ)" error={errorFor("notes")}><textarea name="notes" defaultValue={order.notes} rows={3} maxLength={500} className={inputClass} /></Field>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        <Link href={backHref} className="rounded-lg border border-slate-300 px-5 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50">ยกเลิก</Link>
        <button type="submit" disabled={pending} className="rounded-lg bg-green-800 px-5 py-2.5 text-base font-bold text-yellow-300 hover:bg-green-900 disabled:opacity-50">
          {pending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-base font-semibold text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-red-600">{error}</span>}</label>;
}
