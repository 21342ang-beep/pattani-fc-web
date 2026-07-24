"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  QrCode,
  Smartphone,
  Lock,
  ShieldCheck,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
  Ticket,
  User,
  Phone,
  Mail,
  Crown,
  Star,
  Award,
  Medal,
  Sparkles,
} from "lucide-react";
import {
  SEASON_MATCHES,
  SEASON_LABEL,
  SEASON_PASS_PICKUP_LOCATIONS,
  SEASON_PASS_SHIPPING_FEE_BAHT,
  type SeasonPassSeatZone,
  type SeasonTier,
  type SeasonTierId,
} from "@/lib/season-pass-tiers";
import { createSeasonPassOrder } from "@/app/actions/season-passes";

// Payment gateway ยังเป็น mock (ยังไม่ผูก provider จริง)
// แต่หลัง mock payment สำเร็จ ระบบจะบันทึกออเดอร์ลง DB จริง → admin เห็นทันที

type Step = "form" | "payment" | "success";
type Method = "card" | "promptpay" | "banking";
type DeliveryMethod = "SHIPPING" | "PICKUP";
const SHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"] as const;

export type ShippingProvince = {
  name: string;
  districts: {
    name: string;
    postalCodes: string[];
  }[];
};

interface CustomerData {
  name: string;
  phone: string;
  email: string;
  seatZone: SeasonPassSeatZone | "";
  deliveryMethod: DeliveryMethod;
  shipAddress: string;
  shipCity: string;
  shipProvince: string;
  shipPostalCode: string;
  shirtSize: (typeof SHIRT_SIZES)[number] | "";
  shipNote: string;
  pickupLocation: string;
}

const TIER_ICONS: Record<SeasonTierId, React.ReactNode> = {
  "vvip-elite": <Crown className="size-6" />,
  "vip-advanced": <Star className="size-6" />,
  premium: <Award className="size-6" />,
  gold: <Medal className="size-6" />,
};

export default function SeasonPassWizard({
  tier,
  memberEmail,
  defaultName,
  defaultPhone,
  defaultAddress,
  defaultProvince,
  defaultDistrict,
  defaultPostalCode,
  shippingProvinces,
}: {
  tier: SeasonTier;
  memberEmail: string | null;
  defaultName: string;
  defaultPhone: string;
  defaultAddress: string;
  defaultProvince: string;
  defaultDistrict: string;
  defaultPostalCode: string;
  shippingProvinces: ShippingProvince[];
}) {
  const [step, setStep] = useState<Step>("form");
  const [customer, setCustomer] = useState<CustomerData>({
    name: defaultName,
    phone: defaultPhone,
    email: memberEmail ?? "",
    seatZone: "",
    deliveryMethod: "PICKUP",
    shipAddress: defaultAddress,
    shipCity: defaultDistrict,
    shipProvince: defaultProvince,
    shipPostalCode: defaultPostalCode,
    shirtSize: "",
    shipNote: "",
    pickupLocation: SEASON_PASS_PICKUP_LOCATIONS[0],
  });
  const [passCode, setPassCode] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const shippingFee =
    customer.deliveryMethod === "SHIPPING" ? SEASON_PASS_SHIPPING_FEE_BAHT : 0;
  const totalBaht = tier.priceBaht + shippingFee;

  const isMember = !!memberEmail;

  function handleFormSubmit(data: CustomerData) {
    setCustomer(data);
    setSaveError(null);
    setStep("payment");
  }

  // เรียก server action → บันทึกออเดอร์ลง DB → คืน passCode ที่แท้จริง
  async function handlePaymentSuccess(paymentMethod: Method): Promise<boolean> {
    setSaveError(null);
    if (!customer.seatZone) {
      setSaveError("กรุณาเลือกโซนที่นั่ง");
      setStep("form");
      return false;
    }
    const res = await createSeasonPassOrder({
      tierId: tier.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      seatZone: customer.seatZone,
      paymentMethod,
      deliveryMethod: customer.deliveryMethod,
      shipAddress: customer.shipAddress,
      shipCity: customer.shipCity,
      shipProvince: customer.shipProvince,
      shipPostalCode: customer.shipPostalCode,
      shirtSize: customer.shirtSize,
      shipNote: customer.shipNote,
      pickupLocation: customer.pickupLocation,
    });
    if (!res.ok) {
      setSaveError(res.error);
      return false;
    }
    setPassCode(res.passCode);
    setStep("success");
    return true;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <div>
        <StepBar step={step} />

        <div className="mt-4">
          {step === "form" && (
            <FormStep
              tier={tier}
              initial={customer}
              memberEmail={memberEmail}
              shippingProvinces={shippingProvinces}
              onSubmit={handleFormSubmit}
              onDeliveryMethodChange={(m) =>
                setCustomer((c) => ({ ...c, deliveryMethod: m }))
              }
            />
          )}
          {step === "payment" && (
            <PaymentStep
              totalBaht={totalBaht}
              onBack={() => setStep("form")}
              onSuccess={handlePaymentSuccess}
              saveError={saveError}
            />
          )}
          {step === "success" && (
            <SuccessStep tier={tier} customer={customer} passCode={passCode} />
          )}
        </div>
      </div>

      <TierSummary
        tier={tier}
        isMember={isMember}
        shippingFee={shippingFee}
        totalBaht={totalBaht}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Step bar
// ────────────────────────────────────────────────────────────
function StepBar({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "form", label: "ข้อมูลผู้สมัคร" },
    { id: "payment", label: "ชำระเงิน" },
    { id: "success", label: "รับบัตร" },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-2 text-xs md:text-sm">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full font-bold ${
                done
                  ? "bg-green-800 text-yellow-300"
                  : active
                    ? "bg-yellow-400 text-green-950"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span
              className={`truncate ${
                active
                  ? "font-bold text-green-900"
                  : done
                    ? "text-slate-600"
                    : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="hidden size-4 shrink-0 text-slate-300 md:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ────────────────────────────────────────────────────────────
// STEP 1 — ฟอร์มข้อมูลผู้สมัคร
// ────────────────────────────────────────────────────────────
function FormStep({
  tier,
  initial,
  memberEmail,
  shippingProvinces,
  onSubmit,
  onDeliveryMethodChange,
}: {
  tier: SeasonTier;
  initial: CustomerData;
  memberEmail: string | null;
  shippingProvinces: ShippingProvince[];
  onSubmit: (data: CustomerData) => void;
  onDeliveryMethodChange: (method: DeliveryMethod) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [seatZone, setSeatZone] = useState(initial.seatZone);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    initial.deliveryMethod,
  );
  const [shipAddress, setShipAddress] = useState(initial.shipAddress);
  const [shipCity, setShipCity] = useState(initial.shipCity);
  const [shipProvince, setShipProvince] = useState(initial.shipProvince);
  const [shipPostalCode, setShipPostalCode] = useState(initial.shipPostalCode);
  const [shirtSize, setShirtSize] = useState(initial.shirtSize);
  const [shipNote, setShipNote] = useState(initial.shipNote);
  const [pickupLocation, setPickupLocation] = useState(initial.pickupLocation);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});
  const selectedProvince = useMemo(
    () => shippingProvinces.find((province) => province.name === shipProvince),
    [shipProvince, shippingProvinces],
  );
  const selectedDistrict = selectedProvince?.districts.find(
    (district) => district.name === shipCity,
  );

  function handleProvinceChange(province: string) {
    setShipProvince(province);
    setShipCity("");
    setShipPostalCode("");
  }

  function handleDistrictChange(districtName: string) {
    const district = selectedProvince?.districts.find((item) => item.name === districtName);
    setShipCity(districtName);
    setShipPostalCode(district?.postalCodes.length === 1 ? district.postalCodes[0] : "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (name.trim().length < 2) nextErrors.name = "กรุณากรอกชื่อ-นามสกุล";
    if (!/^[0-9+\-\s()]{9,15}$/.test(phone.trim())) nextErrors.phone = "เบอร์โทรไม่ถูกต้อง";
    // email เป็น optional สำหรับ guest — validate เฉพาะกรณีมีค่า
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }
    if (!seatZone) nextErrors.seatZone = "กรุณาเลือกโซนที่นั่ง";
    if (deliveryMethod === "SHIPPING") {
      if (!shipAddress.trim()) nextErrors.shipAddress = "กรุณากรอกที่อยู่";
      if (!selectedProvince) nextErrors.shipProvince = "กรุณาเลือกจังหวัดจากรายการ";
      if (!selectedDistrict) nextErrors.shipCity = "กรุณาเลือกอำเภอ/เขต";
      if (!selectedDistrict?.postalCodes.includes(shipPostalCode))
        nextErrors.shipPostalCode = "กรุณาเลือกรหัสไปรษณีย์ที่ตรงกับอำเภอ";
      if (!shirtSize) nextErrors.shirtSize = "กรุณาเลือกไซส์เสื้อ";
    } else {
      if (!pickupLocation.trim())
        nextErrors.pickupLocation = "กรุณาเลือกจุดรับบัตร";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      seatZone,
      deliveryMethod,
      shipAddress: shipAddress.trim(),
      shipCity: shipCity.trim(),
      shipProvince: shipProvince.trim(),
      shipPostalCode: shipPostalCode.trim(),
      shirtSize,
      shipNote: shipNote.trim(),
      pickupLocation: pickupLocation.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-7"
      autoComplete="on"
    >
      <div>
        <h2 className="text-lg font-bold text-green-900">ข้อมูลผู้สมัคร</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          บัตรจะออกในชื่อที่กรอกด้านล่าง — ตรวจสอบให้ถูกต้อง
        </p>
      </div>

      <Field label="ชื่อ-นามสกุล" htmlFor="sp-name" icon={<User className="size-4" />} error={errors.name}>
        <input
          id="sp-name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น สมชาย ใจดี"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
        />
      </Field>

      <Field label="เบอร์โทรศัพท์" htmlFor="sp-phone" icon={<Phone className="size-4" />} error={errors.phone}>
        <input
          id="sp-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="เช่น 081-234-5678"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
        />
      </Field>

      <Field
        label="อีเมล"
        htmlFor="sp-email"
        icon={<Mail className="size-4" />}
        error={errors.email}
        hint={memberEmail ? "อีเมลจากบัญชีสมาชิก" : "ไม่บังคับ — สำหรับส่งใบเสร็จ"}
      >
        <input
          id="sp-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!!memberEmail}
          placeholder={memberEmail ? "" : "เช่น you@example.com"}
          className={`w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20 ${
            memberEmail ? "bg-slate-50 text-slate-600" : ""
          }`}
        />
      </Field>

      <Field
        label="โซนที่นั่ง"
        htmlFor="sp-seat-zone"
        error={errors.seatZone}
        hint="กรุณาเลือกโซนสำหรับบัตรรายปี"
      >
        <select
          id="sp-seat-zone"
          value={seatZone}
          onChange={(e) => setSeatZone(e.target.value as typeof seatZone)}
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
        >
          <option value="">เลือกโซนที่นั่ง</option>
          {tier.allowedSeatZones.map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
      </Field>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">
          วิธีรับบัตรสมาชิก
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <DeliveryOption
            id="delivery-pickup"
            active={deliveryMethod === "PICKUP"}
            onClick={() => {
              setDeliveryMethod("PICKUP");
              onDeliveryMethodChange("PICKUP");
            }}
            title="รับด้วยตัวเอง"
            subtitle="ฟรี — เลือกจุดรับด้านล่าง"
          />
          <DeliveryOption
            id="delivery-shipping"
            active={deliveryMethod === "SHIPPING"}
            onClick={() => {
              setDeliveryMethod("SHIPPING");
              onDeliveryMethodChange("SHIPPING");
            }}
            title="ส่งพัสดุ"
            subtitle={`+${SEASON_PASS_SHIPPING_FEE_BAHT} บาท`}
          />
        </div>

        {deliveryMethod === "SHIPPING" ? (
          <div className="mt-4 space-y-3">
            <Field label="ที่อยู่" htmlFor="sp-ship-address" error={errors.shipAddress}>
              <input
                id="sp-ship-address"
                value={shipAddress}
                onChange={(e) => setShipAddress(e.target.value)}
                placeholder="บ้านเลขที่ / หมู่ / ซอย / ถนน"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="จังหวัด" htmlFor="sp-ship-province" error={errors.shipProvince}>
                <ProvinceSelect
                  id="sp-ship-province"
                  value={shipProvince}
                  provinces={shippingProvinces.map((province) => province.name)}
                  onChange={handleProvinceChange}
                />
              </Field>
              <Field label="อำเภอ/เขต" htmlFor="sp-ship-city" error={errors.shipCity}>
                <select
                  id="sp-ship-city"
                  value={shipCity}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={!selectedProvince}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-green-800 focus:ring-2 focus:ring-green-800/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">
                    {selectedProvince ? "เลือกอำเภอ/เขต" : "เลือกจังหวัดก่อน"}
                  </option>
                  {selectedProvince?.districts.map((district) => (
                    <option key={district.name} value={district.name}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="รหัสไปรษณีย์"
              htmlFor="sp-ship-postal"
              error={errors.shipPostalCode}
            >
              <select
                id="sp-ship-postal"
                value={shipPostalCode}
                onChange={(e) => setShipPostalCode(e.target.value)}
                disabled={!selectedDistrict}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-green-800 focus:ring-2 focus:ring-green-800/20 disabled:cursor-not-allowed disabled:bg-slate-100 sm:max-w-[180px]"
              >
                <option value="">{selectedDistrict ? "เลือกรหัสไปรษณีย์" : "เลือกอำเภอก่อน"}</option>
                {selectedDistrict?.postalCodes.map((postalCode) => (
                  <option key={postalCode} value={postalCode}>
                    {postalCode}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ไซส์เสื้อ" htmlFor="sp-shirt-size" error={errors.shirtSize}>
              <select
                id="sp-shirt-size"
                value={shirtSize}
                onChange={(e) =>
                  setShirtSize(e.target.value as CustomerData["shirtSize"])
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-green-800 focus:ring-2 focus:ring-green-800/20 sm:max-w-[180px]"
              >
                <option value="">เลือกไซส์เสื้อ</option>
                {SHIRT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="หมายเหตุ (ไม่บังคับ)" htmlFor="sp-ship-note">
              <input
                id="sp-ship-note"
                value={shipNote}
                onChange={(e) => setShipNote(e.target.value)}
                placeholder="เช่น ฝากไว้ที่หน้าประตู"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
              />
            </Field>
          </div>
        ) : (
          <div className="mt-4">
            <Field
              label="เลือกจุดรับบัตร"
              htmlFor="sp-pickup"
              error={errors.pickupLocation}
            >
              <select
                id="sp-pickup"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
              >
                {SEASON_PASS_PICKUP_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        ข้อมูลนี้จะใช้ในการออกบัตรของคุณ — เมื่อชำระสำเร็จ ระบบจะบันทึกออเดอร์ลงระบบ
      </p>

      <button
        type="submit"
        className="w-full rounded-full bg-green-800 px-5 py-3.5 text-base font-bold text-yellow-300 shadow-md transition hover:bg-green-900"
      >
        ดำเนินการต่อ · ชำระเงิน
      </button>
    </form>
  );
}

function DeliveryOption({
  id,
  active,
  onClick,
  title,
  subtitle,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col rounded-xl border-2 p-3 text-left transition ${
        active
          ? "border-green-800 bg-green-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span
        className={`text-sm font-semibold ${
          active ? "text-green-900" : "text-slate-800"
        }`}
      >
        {title}
      </span>
      <span className="text-[11px] text-slate-500">{subtitle}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// STEP 2 — ชำระเงิน (mock payment gateway)
// ────────────────────────────────────────────────────────────
const METHODS: {
  id: Method;
  label: string;
  sublabel: string;
  Icon: typeof CreditCard;
}[] = [
  { id: "card", label: "บัตรเครดิต / เดบิต", sublabel: "Visa · MC · JCB", Icon: CreditCard },
  { id: "promptpay", label: "PromptPay QR", sublabel: "สแกนด้วยแอปธนาคาร", Icon: QrCode },
  { id: "banking", label: "Mobile Banking", sublabel: "เปิดแอปธนาคาร", Icon: Smartphone },
];

function PaymentStep({
  totalBaht,
  onBack,
  onSuccess,
  saveError,
}: {
  totalBaht: number;
  onBack: () => void;
  onSuccess: (method: Method) => Promise<boolean>;
  saveError: string | null;
}) {
  const [method, setMethod] = useState<Method>("card");
  const [processing, setProcessing] = useState<
    null | "authorizing" | "confirming" | "saving"
  >(null);

  async function runMockPayment() {
    setProcessing("authorizing");
    await sleep(900);
    setProcessing("confirming");
    await sleep(700);
    setProcessing("saving");
    const ok = await onSuccess(method);
    if (!ok) setProcessing(null); // stay on this step to show error
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
          โหมดจำลอง — ยังไม่ได้เชื่อมต่อ payment provider จริง แต่ออเดอร์จะถูกบันทึกลงระบบเพื่อให้ admin เห็น
        </p>
      </header>

      {saveError && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          ⚠️ {saveError}
        </div>
      )}

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
                disabled={!!processing}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition disabled:opacity-60 ${
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
        {method === "card" && (
          <CardPanel
            amountBaht={totalBaht}
            processing={processing}
            onPay={runMockPayment}
          />
        )}
        {method === "promptpay" && (
          <PromptPayPanel amountBaht={totalBaht} processing={processing} onPay={runMockPayment} />
        )}
        {method === "banking" && (
          <BankingPanel amountBaht={totalBaht} processing={processing} onPay={runMockPayment} />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px]">
        <button
          type="button"
          onClick={onBack}
          disabled={!!processing}
          className="text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:opacity-50"
        >
          ← แก้ไขข้อมูลผู้สมัคร
        </button>
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <ShieldCheck className="size-3.5 text-green-700" />
          256-bit SSL · PCI DSS (mock)
        </span>
      </div>
    </div>
  );
}

function CardPanel({
  amountBaht,
  processing,
  onPay,
}: {
  amountBaht: number;
  processing: null | "authorizing" | "confirming" | "saving";
  onPay: () => void;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const digits = cardNumber.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const canPay =
    digits.length >= 13 &&
    digits.length <= 19 &&
    holder.trim().length >= 2 &&
    /^\d{2}\/\d{2}$/.test(expiry) &&
    /^\d{3,4}$/.test(cvv) &&
    !processing;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canPay) onPay();
      }}
      className="space-y-5"
      autoComplete="off"
    >
      <MockPreviewCard digits={digits} holder={holder} expiry={expiry} brand={brand} />

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
        ข้อมูลบัตรอยู่ในเบราว์เซอร์ของคุณเท่านั้น — ไม่ถูกส่งไปที่ใด (โหมดจำลอง)
      </p>

      <PayButton amountBaht={amountBaht} canPay={canPay} processing={processing} />
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
          <span className="font-semibold text-white">{holder || " "}</span>
        </span>
        <span>
          <span className="block text-[9px] text-white/50">Expires</span>
          <span className="font-mono font-semibold text-white">{expiry || "MM/YY"}</span>
        </span>
      </div>
    </div>
  );
}

function PromptPayPanel({
  amountBaht,
  processing,
  onPay,
}: {
  amountBaht: number;
  processing: null | "authorizing" | "confirming" | "saving";
  onPay: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
        <p className="text-sm font-semibold text-green-900">วิธีชำระ (โหมดจำลอง)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>สแกน QR ตัวอย่างด้านล่าง (mock ไม่โอนจริง)</li>
          <li>กดปุ่ม &quot;ยืนยันการชำระ&quot; เพื่อจำลองความสำเร็จ</li>
        </ol>
      </div>

      <div className="flex flex-col items-center gap-3">
        <MockQrPattern />
        <p className="text-sm text-slate-500">
          พร้อมเพย์: <span className="font-mono font-bold text-green-900">08X-XXX-XXXX</span> (mock)
        </p>
        <p className="text-2xl font-black text-green-900">
          {amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
        </p>
      </div>

      <PayButton
        amountBaht={amountBaht}
        canPay={!processing}
        processing={processing}
        onClick={onPay}
        label="ยืนยันการชำระ (mock)"
      />
    </div>
  );
}

// QR mock — ไม่ใช่ QR จริง กันคนเผลอสแกนแล้วเสียเงิน
function MockQrPattern() {
  const cells = useMemo(() => {
    const size = 21;
    const arr: boolean[] = [];
    // seeded pseudo-random pattern (deterministic ที่ให้ดูเหมือน QR)
    let s = 12345;
    for (let i = 0; i < size * size; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      arr.push((s >> 8) % 2 === 0);
    }
    // finder patterns 3 มุม (ให้ดูเหมือน QR จริง)
    const setBlock = (row: number, col: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const inside = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          const border = r === 0 || r === 6 || c === 0 || c === 6;
          arr[(row + r) * size + (col + c)] = border || inside;
        }
      }
    };
    setBlock(0, 0);
    setBlock(0, 14);
    setBlock(14, 0);
    return { cells: arr, size };
  }, []);

  return (
    <div className="rounded-xl border-2 border-green-800 bg-white p-4">
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${cells.size}, 8px)`,
          gridTemplateRows: `repeat(${cells.size}, 8px)`,
        }}
        aria-label="QR ตัวอย่าง (mock)"
      >
        {cells.cells.map((on, i) => (
          <span
            key={i}
            className={on ? "bg-green-950" : "bg-white"}
          />
        ))}
      </div>
    </div>
  );
}

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
  processing,
  onPay,
}: {
  amountBaht: number;
  processing: null | "authorizing" | "confirming" | "saving";
  onPay: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const bank = BANKS.find((b) => b.id === selected);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">เลือกธนาคารของคุณ</p>
        <p className="mt-0.5 text-xs text-slate-500">
          ยอด {amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท (โหมดจำลอง)
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
              disabled={!!processing}
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

      {processing && bank && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <Loader2 className="size-5 shrink-0 animate-spin text-green-800" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-green-900">
              {processing === "authorizing" ? "กำลังเปิดแอป " : "รอการยืนยันจากแอป "}
              {bank.name}...
            </p>
            <p className="text-xs text-green-800/70">โหมดจำลอง — ยืนยันอัตโนมัติภายในไม่กี่วินาที</p>
          </div>
        </div>
      )}

      <PayButton
        amountBaht={amountBaht}
        canPay={!!selected && !processing}
        processing={processing}
        onClick={onPay}
        label={bank ? `ดำเนินการต่อผ่าน ${bank.name}` : "เลือกธนาคารก่อน"}
      />
    </div>
  );
}

function PayButton({
  amountBaht,
  canPay,
  processing,
  onClick,
  label,
}: {
  amountBaht: number;
  canPay: boolean;
  processing: null | "authorizing" | "confirming" | "saving";
  onClick?: () => void;
  label?: string;
}) {
  const busy = !!processing;
  const displayLabel = busy
    ? processing === "authorizing"
      ? "กำลังตรวจสอบ..."
      : processing === "saving"
        ? "กำลังบันทึกออเดอร์..."
        : "กำลังยืนยันการชำระ..."
    : (label ?? `ชำระเงิน ${amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);

  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={!canPay || busy}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-5 py-3.5 text-base font-bold text-green-950 shadow-lg shadow-yellow-400/20 transition hover:scale-[1.005] hover:bg-yellow-300 disabled:opacity-50 disabled:hover:scale-100"
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {displayLabel}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// STEP 3 — สำเร็จ + แสดงบัตรดิจิทัล (mock)
// ────────────────────────────────────────────────────────────
function SuccessStep({
  tier,
  customer,
  passCode,
}: {
  tier: SeasonTier;
  customer: CustomerData;
  passCode: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
          <Check className="size-7" />
        </div>
        <h2 className="mt-3 text-2xl font-black text-emerald-900">สมัครสำเร็จ!</h2>
        <p className="mt-1 text-sm text-emerald-800">
          บัตร {tier.name} ของคุณพร้อมใช้งานแล้ว — เก็บรหัสไว้เพื่อเข้าชม 15 แมตช์
        </p>
      </div>

      <DigitalPass tier={tier} customer={customer} passCode={passCode} />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <p className="font-semibold">หมายเหตุ</p>
        <p className="mt-1 leading-relaxed">
          Payment gateway ยังเป็น mock แต่ออเดอร์ได้บันทึกลงระบบเรียบร้อยแล้ว — แสดง QR นี้ที่ประตูสนามในวันแข่ง
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/matches"
          className="rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-yellow-300 transition hover:bg-green-900"
        >
          ดูโปรแกรมการแข่งขัน
        </Link>
        <Link
          href="/tickets"
          className="rounded-full border border-green-200 bg-white px-6 py-3 text-base font-medium text-green-900 transition hover:bg-green-50"
        >
          กลับหน้าตั๋ว
        </Link>
      </div>
    </div>
  );
}

function DigitalPass({
  tier,
  customer,
  passCode,
}: {
  tier: SeasonTier;
  customer: CustomerData;
  passCode: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-yellow-400 bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 p-6 text-white shadow-2xl shadow-green-900/20 md:p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-yellow-300/80">
            <Sparkles className="size-3.5" /> Season Pass · {SEASON_LABEL}
          </p>
          <p className="mt-2 flex items-center gap-2 text-yellow-300">
            {TIER_ICONS[tier.id]}
            <span className="text-2xl font-black md:text-3xl">{tier.name}</span>
          </p>
        </div>
        <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-300">
          Active
        </span>
      </div>

      <div className="mt-6 border-y border-yellow-300/20 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-yellow-100/60">ในชื่อของ</p>
            <p className="mt-1 text-lg font-bold text-white">{customer.name}</p>
            {customer.email && (
              <p className="text-xs text-yellow-100/70">{customer.email}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-yellow-100/60">แมตช์คงเหลือ</p>
            <p className="mt-1 text-2xl font-black text-yellow-300">
              {SEASON_MATCHES}
              <span className="text-sm text-yellow-100/60"> / {SEASON_MATCHES}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-yellow-100/60">รหัสบัตร</p>
          <p className="mt-1 truncate font-mono text-base font-bold tracking-wider text-yellow-300 md:text-lg">
            {passCode}
          </p>
        </div>
        <div className="w-44 shrink-0 rounded-lg bg-white p-2">
          <img
            src={`/api/season-passes/${encodeURIComponent(passCode)}/barcode`}
            alt={`บาร์โค้ด ${passCode}`}
            className="h-auto w-full"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-[11px] text-yellow-100/60">
        <Ticket className="size-3.5" />
        แสดง QR นี้ที่ประตูสนามในวันแข่ง — บัตรใช้ได้เฉพาะเจ้าของ ไม่สามารถโอนสิทธิ์
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Right column — สรุปบัตร
// ────────────────────────────────────────────────────────────
function TierSummary({
  tier,
  isMember,
  shippingFee,
  totalBaht,
}: {
  tier: SeasonTier;
  isMember: boolean;
  shippingFee: number;
  totalBaht: number;
}) {
  return (
    <aside className="h-fit space-y-5 rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
          บัตรที่เลือก
        </p>
        <p className="mt-1 flex items-center gap-2 text-2xl font-black text-green-900">
          {TIER_ICONS[tier.id]}
          {tier.name}
        </p>
        <p className="mt-1 text-sm text-slate-600">{tier.tagline}</p>
      </div>

      <div className="border-y border-slate-200 py-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-500">ราคาบัตร</span>
          <span className="font-semibold text-slate-800">
            ฿{tier.priceBaht.toLocaleString("th-TH")}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between text-sm">
          <span className="text-slate-500">ค่าจัดส่ง</span>
          <span
            className={`font-semibold ${
              shippingFee > 0 ? "text-slate-800" : "text-emerald-700"
            }`}
          >
            {shippingFee > 0
              ? `฿${shippingFee.toLocaleString("th-TH")}`
              : "ฟรี"}
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-slate-200 pt-3">
          <span className="text-sm font-semibold text-slate-700">ยอดรวม</span>
          <span className="text-3xl font-black text-green-900">
            {totalBaht.toLocaleString("th-TH")}
            <span className="ml-1 text-sm font-medium text-slate-500">บาท</span>
          </span>
        </div>
        <p className="mt-1 text-right text-xs text-slate-500">
          / ฤดูกาล {SEASON_LABEL} · {SEASON_MATCHES} แมตช์
        </p>
      </div>

      <ul className="space-y-2 text-sm">
        {tier.benefits.slice(0, 5).map((b) => (
          <li key={b} className="flex items-start gap-2 text-slate-700">
            <Check className="mt-0.5 size-4 shrink-0 text-green-700" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          isMember
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        {isMember
          ? "✓ สมาชิก — ข้อมูลถูกกรอกให้อัตโนมัติ"
          : "ลูกค้าทั่วไป — ไม่ต้องสมัครสมาชิกก่อนซื้อ"}
      </div>
    </aside>
  );
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function Field({
  label,
  htmlFor,
  hint,
  error,
  icon,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600"
      >
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {hint && <span className="text-[10px] font-normal text-slate-400">{hint}</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ProvinceSelect({
  id,
  value,
  provinces,
  onChange,
}: {
  id: string;
  value: string;
  provinces: string[];
  onChange: (province: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputValue = open ? query : value;
  const filteredProvinces = provinces.filter((province) => province.includes(inputValue.trim()));

  return (
    <div className="relative">
      <input
        id={id}
        value={inputValue}
        onFocus={() => {
          setQuery(value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
          }, 150);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        placeholder="พิมพ์ค้นหาหรือเลือกจังหวัด"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 outline-none focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      {open && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filteredProvinces.length > 0 ? (
            filteredProvinces.map((province) => (
              <li key={province} role="option" aria-selected={province === value}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(province);
                    setOpen(false);
                  }}
                  className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-green-50 ${
                    province === value ? "bg-green-50 font-semibold text-green-900" : "text-slate-700"
                  }`}
                >
                  {province}
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-slate-500">ไม่พบจังหวัดที่ค้นหา</li>
          )}
        </ul>
      )}
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
