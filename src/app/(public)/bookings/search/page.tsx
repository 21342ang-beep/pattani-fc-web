import BookingSearchTabs from "./BookingSearchTabs";
import { getT } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/text";

export const metadata = { title: "ตรวจสอบการจอง — Pattani FC" };

export default async function BookingSearchPage() {
  const { locale } = await getT();
  const t = (th: string, en: string) => localize(locale, th, en);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16 lg:py-20">
      <header>
        <p className="text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl">{t("ค้นหาการจอง", "Booking search")}</p>
        <h1 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">{t("ตรวจสอบการจอง", "Check Booking")}</h1>
        <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">{t("ค้นหาตั๋วรายแมตช์และบัตรรายปีด้วยเบอร์โทรศัพท์ที่ใช้จอง แล้วรับรหัส OTP เพื่อยืนยันการค้นหา ไม่ต้องเข้าสู่ระบบหรือเคยยืนยันเบอร์กับบัญชีมาก่อน", "Find match tickets and season passes using your booking phone number, then verify an OTP for this search. No login or previous account phone verification is required.")}</p>
      </header>
      <BookingSearchTabs locale={locale} />
    </div>
  );
}
