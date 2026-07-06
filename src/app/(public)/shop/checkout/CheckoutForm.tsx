"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  QrCode,
  Banknote,
  Truck,
  Zap,
  MapPin,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import {
  PAYMENT_LABEL,
  SHIPPING_FEE_BAHT,
  SHIPPING_LABEL,
  cartSubtotalBaht,
  clearCart,
  readCart,
  type ShopCartItem,
} from "@/lib/shop-cart";
import { createShopOrder, type ShopOrderState } from "@/app/actions/shop";

type ShippingMethod = "STANDARD" | "EXPRESS" | "PICKUP";
type PaymentMethod = "PROMPTPAY" | "BANK_TRANSFER" | "COD";

export default function CheckoutForm({
  prefill,
}: {
  prefill: { name: string; phone: string; email: string };
}) {
  const router = useRouter();
  const [items, setItems] = useState<ShopCartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [shipping, setShipping] = useState<ShippingMethod>("STANDARD");
  const [payment, setPayment] = useState<PaymentMethod>("PROMPTPAY");
  const [state, formAction, pending] = useActionState<ShopOrderState, FormData>(
    async (prev, fd) => createShopOrder(prev, fd),
    undefined
  );

  useEffect(() => {
    setItems(readCart());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state?.redirectTo) {
      clearCart();
      router.push(state.redirectTo);
    }
  }, [state, router]);

  // COD ใช้กับ PICKUP ไม่ได้ — UI sync ให้
  useEffect(() => {
    if (shipping === "PICKUP" && payment === "COD") {
      setPayment("PROMPTPAY");
    }
  }, [shipping, payment]);

  const subtotalBaht = useMemo(() => cartSubtotalBaht(items), [items]);
  const shippingFeeBaht = SHIPPING_FEE_BAHT[shipping];
  const totalBaht = subtotalBaht + shippingFeeBaht;

  if (!mounted) {
    return <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <ShoppingBag className="mx-auto size-10 text-slate-300" />
        <p className="mt-3 text-lg font-semibold text-slate-500">
          ยังไม่มีสินค้าในตะกร้า
        </p>
        <Link
          href="/shop"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-green-800 px-5 py-2.5 text-sm font-bold text-yellow-300 hover:bg-green-900"
        >
          เลือกซื้อสินค้า <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  // server จะรับ items แบบ JSON — ส่งเฉพาะ id/qty/size (ไม่ส่งราคา server คำนวณเอง)
  const itemsPayload = JSON.stringify(
    items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      size: it.size,
    }))
  );

  return (
    <form action={formAction} className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
      <input type="hidden" name="items" value={itemsPayload} />
      <input type="hidden" name="shippingMethod" value={shipping} />
      <input type="hidden" name="paymentMethod" value={payment} />

      <div className="space-y-6">
        {/* 1. ข้อมูลผู้รับ */}
        <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-base font-black text-green-900">1 · ข้อมูลผู้รับ</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="ชื่อ-นามสกุล"
              name="customerName"
              defaultValue={prefill.name}
              required
              maxLength={100}
              errors={state?.fieldErrors?.customerName}
            />
            <Field
              label="เบอร์โทร"
              name="customerPhone"
              defaultValue={prefill.phone}
              required
              maxLength={20}
              errors={state?.fieldErrors?.customerPhone}
            />
            <div className="sm:col-span-2">
              <Field
                label="อีเมล (ไม่บังคับ)"
                name="customerEmail"
                type="email"
                defaultValue={prefill.email}
                maxLength={200}
                errors={state?.fieldErrors?.customerEmail}
              />
            </div>
          </div>
        </section>

        {/* 2. วิธีจัดส่ง */}
        <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-base font-black text-green-900">2 · วิธีจัดส่ง</h2>
          <div className="mt-4 grid gap-2.5">
            <OptionCard
              active={shipping === "STANDARD"}
              onClick={() => setShipping("STANDARD")}
              icon={<Truck className="size-5" />}
              title="ส่งมาตรฐาน"
              desc={SHIPPING_LABEL.STANDARD}
              priceBaht={SHIPPING_FEE_BAHT.STANDARD}
            />
            <OptionCard
              active={shipping === "EXPRESS"}
              onClick={() => setShipping("EXPRESS")}
              icon={<Zap className="size-5" />}
              title="ส่งด่วน"
              desc={SHIPPING_LABEL.EXPRESS}
              priceBaht={SHIPPING_FEE_BAHT.EXPRESS}
            />
            <OptionCard
              active={shipping === "PICKUP"}
              onClick={() => setShipping("PICKUP")}
              icon={<MapPin className="size-5" />}
              title="รับเองที่สโมสร"
              desc={SHIPPING_LABEL.PICKUP}
              priceBaht={0}
            />
          </div>

          {/* address fields */}
          {shipping !== "PICKUP" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="ที่อยู่ (บ้านเลขที่ ตำบล)"
                  name="shipAddress"
                  required
                  maxLength={500}
                  errors={state?.fieldErrors?.shipAddress}
                />
              </div>
              <Field
                label="อำเภอ / เขต"
                name="shipCity"
                required
                maxLength={120}
                errors={state?.fieldErrors?.shipCity}
              />
              <Field
                label="จังหวัด"
                name="shipProvince"
                required
                maxLength={120}
                errors={state?.fieldErrors?.shipProvince}
              />
              <Field
                label="รหัสไปรษณีย์"
                name="shipPostalCode"
                required
                maxLength={5}
                inputMode="numeric"
                pattern="\d{5}"
                errors={state?.fieldErrors?.shipPostalCode}
              />
              <Field
                label="หมายเหตุ (ถ้ามี)"
                name="shipNote"
                maxLength={500}
              />
            </div>
          )}
        </section>

        {/* 3. วิธีชำระเงิน */}
        <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-base font-black text-green-900">3 · วิธีชำระเงิน</h2>
          <div className="mt-4 grid gap-2.5">
            <OptionCard
              active={payment === "PROMPTPAY"}
              onClick={() => setPayment("PROMPTPAY")}
              icon={<QrCode className="size-5" />}
              title={PAYMENT_LABEL.PROMPTPAY}
              desc="สแกน QR ด้วยแอปธนาคาร"
            />
            <OptionCard
              active={payment === "BANK_TRANSFER"}
              onClick={() => setPayment("BANK_TRANSFER")}
              icon={<CreditCard className="size-5" />}
              title={PAYMENT_LABEL.BANK_TRANSFER}
              desc="โอนตามเลขบัญชีสโมสร แล้วยืนยันสลิป"
            />
            <OptionCard
              active={payment === "COD"}
              disabled={shipping === "PICKUP"}
              onClick={() => shipping !== "PICKUP" && setPayment("COD")}
              icon={<Banknote className="size-5" />}
              title={PAYMENT_LABEL.COD}
              desc={
                shipping === "PICKUP"
                  ? "ไม่สามารถเก็บปลายทางได้สำหรับรับเองที่สโมสร"
                  : "จ่ายเงินสดกับพนักงานส่งของ"
              }
            />
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="h-fit space-y-3 rounded-2xl border-2 border-green-100 bg-white p-5 shadow-sm md:sticky md:top-6">
        <h2 className="text-base font-black text-green-900">สรุปคำสั่งซื้อ</h2>
        <ul className="space-y-2 border-b border-slate-100 pb-3 text-sm">
          {items.map((it) => (
            <li key={`${it.productId}|${it.size ?? ""}`} className="flex justify-between gap-2">
              <span className="line-clamp-1 text-slate-700">
                {it.name}
                {it.size && <span className="text-slate-400"> · {it.size}</span>}
                <span className="ml-1 text-slate-400">×{it.quantity}</span>
              </span>
              <span className="shrink-0 font-bold text-slate-900">
                {(it.unitPriceBaht * it.quantity).toLocaleString("th-TH")} ฿
              </span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">ยอดสินค้า</dt>
            <dd className="font-medium">{subtotalBaht.toLocaleString("th-TH")} ฿</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">ค่าจัดส่ง</dt>
            <dd className="font-medium">
              {shippingFeeBaht === 0 ? "ฟรี" : `${shippingFeeBaht.toLocaleString("th-TH")} ฿`}
            </dd>
          </div>
        </dl>
        <div className="border-t border-slate-200 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">ยอดรวมทั้งสิ้น</span>
            <span className="text-2xl font-black text-green-900">
              {totalBaht.toLocaleString("th-TH")} ฿
            </span>
          </div>
        </div>

        {state?.error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-yellow-400 px-5 py-3 text-base font-bold text-green-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {pending ? "กำลังสร้างออเดอร์..." : "ยืนยันคำสั่งซื้อ"}
        </button>
        <p className="text-center text-[11px] text-slate-500">
          คลิกยืนยัน = ยอมรับเงื่อนไขการจัดส่งและการคืนสินค้าของสโมสร
        </p>
      </aside>
    </form>
  );
}

function OptionCard({
  active,
  disabled,
  onClick,
  icon,
  title,
  desc,
  priceBaht,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  priceBaht?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
          : active
            ? "border-green-700 bg-green-50 text-green-900 shadow-sm"
            : "border-slate-200 bg-white text-slate-700 hover:border-green-300"
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
          disabled
            ? "bg-slate-100 text-slate-300"
            : active
              ? "bg-green-700 text-yellow-200"
              : "bg-slate-100 text-slate-600"
        }`}
      >
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      {priceBaht != null && (
        <span className="text-sm font-bold">
          {priceBaht === 0 ? "ฟรี" : `${priceBaht} ฿`}
        </span>
      )}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  maxLength,
  inputMode,
  pattern,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "tel" | "email";
  pattern?: string;
  errors?: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        pattern={pattern}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
      />
      {errors && errors.length > 0 && (
        <p className="mt-1 text-xs text-rose-600">{errors[0]}</p>
      )}
    </div>
  );
}
