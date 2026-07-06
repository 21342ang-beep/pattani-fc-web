"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  QrCode,
  Smartphone,
  Lock,
  ShieldCheck,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { confirmPayment, type ConfirmPaymentState } from "@/app/actions/checkout";

// หน้าชำระเงินแบบ payment gateway (mock)
// ⚠️ ข้อมูลบัตรทั้งหมดเป็น client-side only — ไม่ถูกส่งไปที่ server
//    server action `confirmPayment` รับเฉพาะ bookingCode + phone (เหมือน PromptPay flow)
//    method ถูก fix เป็น PROMPTPAY ที่ server → กันการปลอม method จาก client

type Method = "card" | "promptpay" | "banking";

const METHODS: {
  id: Method;
  label: string;
  sublabel: string;
  Icon: typeof CreditCard;
}[] = [
  { id: "card", label: "บัตรเครดิต / เดบิต", sublabel: "Visa · Mastercard · JCB", Icon: CreditCard },
  { id: "promptpay", label: "PromptPay QR", sublabel: "สแกนด้วยแอปธนาคาร", Icon: QrCode },
  { id: "banking", label: "Mobile Banking", sublabel: "เปิดแอปธนาคารโดยตรง", Icon: Smartphone },
];

export default function PaymentGateway({
  bookingCode,
  phone,
  amountBaht,
  qrSvg,
  promptpay,
}: {
  bookingCode: string;
  phone: string;
  amountBaht: number;
  qrSvg: string;
  promptpay: string;
}) {
  const [method, setMethod] = useState<Method>("card");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ConfirmPaymentState, FormData>(
    confirmPayment,
    undefined
  );

  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <GatewayHeader />

      <div className="border-b border-slate-200 bg-slate-50/60 p-4 md:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          เลือกวิธีชำระเงิน
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {METHODS.map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                  active
                    ? "border-green-800 bg-green-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                aria-pressed={active}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                    active ? "bg-green-800 text-yellow-300" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <m.Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${active ? "text-green-900" : "text-slate-800"}`}>
                    {m.label}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">{m.sublabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 md:p-7">
        {state?.error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {method === "card" && (
          <CardPanel
            amountBaht={amountBaht}
            bookingCode={bookingCode}
            phoneValue={phone}
            formAction={formAction}
            pending={pending}
          />
        )}

        {method === "promptpay" && (
          <PromptPayPanel
            amountBaht={amountBaht}
            promptpay={promptpay}
            qrSvg={qrSvg}
            bookingCode={bookingCode}
            phoneValue={phone}
            formAction={formAction}
            pending={pending}
          />
        )}

        {method === "banking" && (
          <BankingPanel
            amountBaht={amountBaht}
            bookingCode={bookingCode}
            phoneValue={phone}
            formAction={formAction}
            pending={pending}
          />
        )}
      </div>

      <GatewayFooter />
    </div>
  );
}

function GatewayHeader() {
  return (
    <header className="border-b border-slate-200 bg-gradient-to-r from-green-950 to-green-800 px-6 py-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Lock className="size-4 text-yellow-300" />
          <span className="text-sm font-bold tracking-wide">SECURE PAYMENT GATEWAY</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-300">
          <span className="size-1.5 rounded-full bg-yellow-300" />
          Test mode
        </span>
      </div>
      <p className="mt-1 text-[11px] text-white/70">
        โหมดจำลอง — ยังไม่ได้เชื่อมต่อ payment provider จริง ข้อมูลบัตรจะไม่ถูกบันทึกหรือส่งไปที่ระบบใด ๆ
      </p>
    </header>
  );
}

function GatewayFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-500">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-green-700" />
          256-bit SSL · PCI DSS Compliant (mock)
        </span>
        <span className="flex items-center gap-1.5 font-mono font-bold text-slate-400">
          <span className="rounded bg-slate-200 px-1.5 py-0.5">VISA</span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5">MC</span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5">JCB</span>
        </span>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────
// Credit/Debit Card (mock — ไม่ส่งข้อมูลบัตรไป server)
// ─────────────────────────────────────────────────────────
function CardPanel({
  amountBaht,
  bookingCode,
  phoneValue,
  formAction,
  pending,
}: {
  amountBaht: number;
  bookingCode: string;
  phoneValue: string;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState<null | "authorizing" | "confirming">(null);

  const digits = cardNumber.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const canSubmit =
    digits.length >= 13 &&
    digits.length <= 19 &&
    holder.trim().length >= 2 &&
    /^\d{2}\/\d{2}$/.test(expiry) &&
    /^\d{3,4}$/.test(cvv) &&
    !pending &&
    !processing;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    // MOCK flow — จำลอง 2 stage: authorize → confirm
    // ข้อมูลบัตรอยู่แค่ใน component state → ไม่มี network request
    setProcessing("authorizing");
    await sleep(900);
    setProcessing("confirming");
    await sleep(600);

    // ส่งแค่ bookingCode + phone ไป server action (ไม่ส่งข้อมูลบัตร)
    const fd = new FormData();
    fd.set("bookingCode", bookingCode);
    fd.set("phone", phoneValue);
    // ต้องอยู่ใน startTransition — เพราะเรียก formAction programmatically
    // (ไม่ได้ผ่าน <form action={formAction}>)
    startTransition(() => formAction(fd));
    // ไม่ต้อง setProcessing(null) — pending จะ takeover, redirect หลังสำเร็จ
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
      <MockPreviewCard
        digits={digits}
        holder={holder}
        expiry={expiry}
        brand={brand}
      />

      <div className="space-y-4">
        <Field label="หมายเลขบัตร" htmlFor="cc-number">
          <div className="relative">
            <input
              id="cc-number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={formatCardNumber(cardNumber)}
              onChange={(e) => setCardNumber(e.target.value.slice(0, 23))}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-16 font-mono text-base tracking-wider outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">
              {brand}
            </span>
          </div>
        </Field>

        <Field label="ชื่อบนบัตร" htmlFor="cc-holder">
          <input
            id="cc-holder"
            autoComplete="off"
            placeholder="SOMCHAI CHAIYO"
            value={holder}
            onChange={(e) => setHolder(e.target.value.toUpperCase().slice(0, 40))}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 uppercase tracking-wider outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="วันหมดอายุ" htmlFor="cc-exp">
            <input
              id="cc-exp"
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-mono outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
            />
          </Field>
          <Field label="CVV" htmlFor="cc-cvv" hint="3 หลักด้านหลังบัตร">
            <input
              id="cc-cvv"
              inputMode="numeric"
              autoComplete="off"
              placeholder="•••"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-mono tracking-widest outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
            />
          </Field>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        ข้อมูลบัตรจะไม่ถูกส่งไปที่เซิร์ฟเวอร์หรือบันทึกในระบบ — นี่เป็นโหมดจำลองสำหรับการพัฒนา
      </p>

      <PayButton
        pending={pending || !!processing}
        canSubmit={canSubmit}
        amountBaht={amountBaht}
        stage={processing}
      />
    </form>
  );
}

function MockPreviewCard({
  digits,
  holder,
  expiry,
  brand,
}: {
  digits: string;
  holder: string;
  expiry: string;
  brand: string;
}) {
  const masked = (digits.padEnd(16, "•").match(/.{1,4}/g) ?? []).slice(0, 4).join(" ");
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 p-5 text-white shadow-lg">
      <div className="absolute -right-8 -top-8 size-40 rounded-full bg-yellow-300/10" />
      <div className="absolute -bottom-10 -left-6 size-32 rounded-full bg-yellow-300/10" />
      <div className="relative flex items-start justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-yellow-300/80">
          Pattani FC · Card
        </span>
        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-yellow-200">
          {brand}
        </span>
      </div>
      <div className="relative mt-8 font-mono text-lg tracking-[0.25em] text-white/95 md:text-xl">
        {masked}
      </div>
      <div className="relative mt-4 flex items-end justify-between text-[11px] uppercase tracking-widest text-white/80">
        <span>
          <span className="block text-[9px] text-white/50">Cardholder</span>
          <span className="font-semibold text-white">
            {holder || " "}
          </span>
        </span>
        <span>
          <span className="block text-[9px] text-white/50">Expires</span>
          <span className="font-mono font-semibold text-white">{expiry || "MM/YY"}</span>
        </span>
      </div>
    </div>
  );
}

function PayButton({
  pending,
  canSubmit,
  amountBaht,
  stage,
}: {
  pending: boolean;
  canSubmit: boolean;
  amountBaht: number;
  stage: null | "authorizing" | "confirming";
}) {
  const label = stage === "authorizing"
    ? "กำลังตรวจสอบบัตร..."
    : stage === "confirming"
      ? "กำลังยืนยันการชำระ..."
      : pending
        ? "กำลังยืนยันการชำระ..."
        : `ชำระเงิน ${amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;

  return (
    <button
      type="submit"
      disabled={!canSubmit}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-5 py-3.5 text-base font-bold text-green-950 shadow-lg shadow-yellow-400/20 transition hover:scale-[1.005] hover:bg-yellow-300 disabled:opacity-50 disabled:hover:scale-100"
    >
      {(pending || stage) && <Loader2 className="size-4 animate-spin" />}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// PromptPay QR
// ─────────────────────────────────────────────────────────
function PromptPayPanel({
  amountBaht,
  promptpay,
  qrSvg,
  bookingCode,
  phoneValue,
  formAction,
  pending,
}: {
  amountBaht: number;
  promptpay: string;
  qrSvg: string;
  bookingCode: string;
  phoneValue: string;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
        <p className="text-sm font-semibold text-green-900">วิธีชำระ</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>เปิดแอปธนาคาร → สแกน QR Code ด้านล่าง</li>
          <li>ตรวจสอบยอด {amountBaht.toLocaleString("th-TH")} บาท แล้วยืนยันการโอน</li>
          <li>กดปุ่ม &quot;ฉันชำระเงินแล้ว&quot; เพื่อรับ E-Ticket</li>
        </ol>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-xl border-2 border-green-800 bg-white p-4"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-sm text-slate-500">
          พร้อมเพย์: <span className="font-mono font-bold text-green-900">{promptpay}</span>
        </p>
        <p className="text-2xl font-black text-green-900">
          {amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
        </p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="bookingCode" value={bookingCode} />
        <input type="hidden" name="phone" value={phoneValue} />
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-5 py-3.5 text-base font-bold text-green-950 shadow-lg shadow-yellow-400/20 transition hover:scale-[1.005] hover:bg-yellow-300 disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "กำลังตรวจสอบการชำระ..." : "ฉันชำระเงินแล้ว"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Mobile Banking (mock — จำลองการเปิดแอปธนาคาร)
// ─────────────────────────────────────────────────────────
const BANKS = [
  { id: "kbank", name: "K PLUS", brand: "กสิกรไทย", color: "bg-green-600" },
  { id: "scb", name: "SCB EASY", brand: "ไทยพาณิชย์", color: "bg-purple-700" },
  { id: "bbl", name: "Bualuang", brand: "กรุงเทพ", color: "bg-blue-700" },
  { id: "ktb", name: "Krungthai NEXT", brand: "กรุงไทย", color: "bg-sky-600" },
  { id: "bay", name: "KMA", brand: "กรุงศรี", color: "bg-yellow-500" },
  { id: "ttb", name: "ttb touch", brand: "ทีทีบี", color: "bg-blue-500" },
];

function BankingPanel({
  amountBaht,
  bookingCode,
  phoneValue,
  formAction,
  pending,
}: {
  amountBaht: number;
  bookingCode: string;
  phoneValue: string;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<null | "opening" | "waiting">(null);
  const selectedBank = useMemo(() => BANKS.find((b) => b.id === selected), [selected]);

  async function handleContinue() {
    if (!selectedBank) return;
    setStage("opening");
    await sleep(900);
    setStage("waiting");
    await sleep(1400);
    const fd = new FormData();
    fd.set("bookingCode", bookingCode);
    fd.set("phone", phoneValue);
    startTransition(() => formAction(fd));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">เลือกธนาคารของคุณ</p>
        <p className="mt-0.5 text-xs text-slate-500">
          ระบบจะจำลองการเปิดแอปธนาคาร — ยอด {amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {BANKS.map((b) => {
          const active = selected === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(b.id)}
              disabled={!!stage || pending}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition disabled:opacity-60 ${
                active
                  ? "border-green-800 bg-green-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${b.color} text-xs font-black text-white`}>
                {b.brand.slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">{b.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{b.brand}</span>
              </span>
            </button>
          );
        })}
      </div>

      {stage && selectedBank && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <Loader2 className="size-5 shrink-0 animate-spin text-green-800" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-green-900">
              {stage === "opening" ? "กำลังเปิดแอป " : "รอการยืนยันจากแอป "}
              {selectedBank.name}...
            </p>
            <p className="text-xs text-green-800/70">
              โหมดจำลอง — ระบบจะยืนยันอัตโนมัติภายในไม่กี่วินาที
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!selected || !!stage || pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-5 py-3.5 text-base font-bold text-green-950 shadow-lg shadow-yellow-400/20 transition hover:scale-[1.005] hover:bg-yellow-300 disabled:opacity-50 disabled:hover:scale-100"
      >
        {(stage || pending) && <Loader2 className="size-4 animate-spin" />}
        {stage || pending
          ? "กำลังดำเนินการ..."
          : selectedBank
            ? `ดำเนินการต่อผ่าน ${selectedBank.name}`
            : "เลือกธนาคารก่อน"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-normal text-slate-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function formatCardNumber(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function detectBrand(digits: string): string {
  if (!digits) return "CARD";
  if (/^4/.test(digits)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "MASTERCARD";
  if (/^35/.test(digits)) return "JCB";
  if (/^3[47]/.test(digits)) return "AMEX";
  return "CARD";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
