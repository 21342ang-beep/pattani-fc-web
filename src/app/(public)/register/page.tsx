import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getAllProvinces } from "geothai";
import { readCustomerSession } from "@/lib/customer-session";
import { getSafeReturnTo } from "@/lib/oauth";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import RegisterForm, { type ShippingProvince } from "./RegisterForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "สมัครสมาชิก — Pattani FC" };

const ERROR_MESSAGES: Record<string, string> = {
  missing_consent: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก",
  no_email:
    "บัญชี LINE ของคุณไม่ได้ให้อีเมล — กรุณาสมัครด้วยอีเมลหรือใช้ Google แทน",
  no_account:
    "ยังไม่พบบัญชีนี้ในระบบ — กรุณาสมัครสมาชิกก่อน (ยอมรับนโยบายด้านล่างแล้วกดปุ่ม social)",
  state_mismatch: "การเชื่อมต่อกับ provider หมดอายุ กรุณาลองใหม่",
  provider_denied: "คุณยกเลิกการอนุญาตกับ provider",
  provider_fetch_failed: "ไม่สามารถดึงข้อมูลจาก provider ได้",
  provider_not_configured: "ยังไม่ได้เปิดใช้บริการนี้ กรุณาสมัครด้วยอีเมลก่อน",
  email_not_verified:
    "อีเมลของบัญชี Google ยังไม่ได้ยืนยัน กรุณายืนยันก่อนเชื่อมต่อ",
  conflict: "เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี กรุณาลองใหม่",
};

export default async function RegisterPage(props: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await props.searchParams;
  const returnTo = getSafeReturnTo(sp.next);
  const session = await readCustomerSession();
  if (session) redirect(returnTo ?? "/member");
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] : undefined;
  const turnstileSiteKey = getTurnstileSiteKey();
  const shippingProvinces: ShippingProvince[] = getAllProvinces()
    .map((province) => ({
      name: province.name_th,
      districts: province.districts.map((district) => ({
        name: district.name_th,
        postalCodes: [...new Set(district.subdistricts.map((subdistrict) => String(subdistrict.postal_code)))].sort(),
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th-TH"));

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-green-50 via-yellow-50 to-green-100 px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-green-200 bg-white p-7 shadow-xl md:p-9">
        <div className="mb-6 flex flex-col items-center">
          <Image
            src="/logo-pattani-fc.png"
            alt="Pattani FC"
            width={80}
            height={80}
          />
          <h1 className="mt-3 text-3xl font-black text-green-900 md:text-4xl">
            สมัครสมาชิก
          </h1>
          <p className="mt-1.5 text-center text-base text-slate-600 md:text-lg">
            ลงทะเบียนเพื่อซื้อสินค้าทางการของสโมสร
            <br />
            และร่วมกิจกรรมลุ้นรางวัลพิเศษ
          </p>
        </div>

        <RegisterForm
          errorMessage={errorMessage}
          shippingProvinces={shippingProvinces}
          returnTo={returnTo ?? undefined}
          turnstileSiteKey={turnstileSiteKey ?? undefined}
        />

        <p className="mt-6 text-center text-base text-slate-600 md:text-lg">
          มีบัญชีอยู่แล้ว?{" "}
          <Link
            href="/member/login"
            className="font-semibold text-green-800 hover:underline"
          >
            เข้าสู่ระบบ
          </Link>
        </p>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-green-800"
          >
            <Shield className="size-4" />
            เป็นผู้ดูแลระบบ? เข้าสู่ระบบที่นี่
          </Link>
        </div>
      </div>
    </main>
  );
}
