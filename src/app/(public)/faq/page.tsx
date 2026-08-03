export const metadata = { title: "คำถามที่พบบ่อย — Ticket Online" };

import { getT } from "@/lib/i18n/server";

const faqs = [
  {
    q: "จองตั๋วยังไง?",
    a: "เลือกแมตช์จากหน้าตารางแข่งขัน กรอกชื่อ อีเมล เบอร์โทร และจำนวนตั๋ว เมื่อจองสำเร็จระบบจะแสดงรหัสการจองให้เก็บไว้",
  },
  {
    q: "จองได้สูงสุดกี่ใบต่อครั้ง?",
    a: "สูงสุด 10 ใบต่อการจอง 1 ครั้ง เพื่อให้แฟนบอลคนอื่นได้มีโอกาสจองด้วย",
  },
  {
    q: "ตรวจสอบสถานะการจองที่ไหน?",
    a: "ไปที่เมนู \"ตรวจสอบการจอง\" แล้วกรอกรหัสการจองและอีเมลที่ใช้ตอนจอง",
  },
  {
    q: "ยกเลิกการจองได้ไหม?",
    a: "หลังจองแล้วการยกเลิกต้องติดต่อทีมงานโดยตรง — ดูช่องทางในหน้า \"ติดต่อเรา\"",
  },
  {
    q: "ข้อมูลส่วนตัวปลอดภัยไหม?",
    a: "เก็บข้อมูลเฉพาะที่จำเป็น (ชื่อ อีเมล เบอร์โทร) เพื่อยืนยันการจอง รหัสผ่านทุกบัญชี admin เข้ารหัสด้วย bcrypt และระบบใช้ HTTPS-only cookie",
  },
  {
    q: "ลืมรหัสการจองทำยังไง?",
    a: "ติดต่อทีมงานพร้อมแจ้งอีเมลที่ใช้ตอนจอง — เราจะตรวจสอบและส่งรหัสกลับให้ทางอีเมลเดิม",
  },
];

const faqsEn = [
  { q: "How do I book tickets?", a: "Choose a match, select a seating zone, enter the required booking details, and complete payment. Your E-Ticket will be available after successful payment." },
  { q: "How many tickets can I book at once?", a: "You can book up to 10 tickets in one transaction." },
  { q: "Where can I check my booking?", a: "Open Check Booking, enter the phone number used for booking, and verify the OTP. The system will show all match tickets and season passes linked to that number." },
  { q: "Can I cancel a booking?", a: "Please contact the club directly regarding cancellation eligibility and applicable terms." },
  { q: "Is my personal information secure?", a: "The system stores only information required to provide the service and uses security controls including encrypted passwords and secure cookies." },
  { q: "What if I cannot find my booking?", a: "Search with the phone number used for the booking. If it still does not appear, contact the club for assistance." },
];
const faqsMs = [
  { q: "Bagaimanakah cara menempah tiket?", a: "Pilih perlawanan dan zon tempat duduk, masukkan maklumat yang diperlukan, kemudian lengkapkan pembayaran. E-Tiket tersedia selepas pembayaran berjaya." },
  { q: "Berapa banyak tiket boleh ditempah sekali gus?", a: "Anda boleh menempah sehingga 10 tiket dalam satu transaksi." },
  { q: "Di manakah saya boleh menyemak tempahan?", a: "Buka Semak Tempahan, masukkan nombor telefon yang digunakan dan sahkan OTP untuk melihat semua tiket serta pas musim." },
  { q: "Bolehkah tempahan dibatalkan?", a: "Sila hubungi kelab secara langsung untuk menyemak kelayakan pembatalan dan syarat yang berkaitan." },
  { q: "Adakah maklumat peribadi saya selamat?", a: "Sistem hanya menyimpan maklumat yang diperlukan dan menggunakan kawalan keselamatan termasuk kata laluan disulitkan serta kuki selamat." },
  { q: "Bagaimana jika tempahan tidak ditemui?", a: "Cari menggunakan nombor telefon yang digunakan semasa menempah. Jika masih tidak ditemui, hubungi kelab." },
];

export default async function FAQPage() {
  const { locale } = await getT();
  const items = locale === "th" ? faqs : locale === "ms" ? faqsMs : faqsEn;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 md:py-16">
      <header>
        <h1 className="text-2xl font-bold">{locale === "th" ? "คำถามที่พบบ่อย" : locale === "ms" ? "Soalan Lazim" : "Frequently Asked Questions"}</h1>
        <p className="text-sm text-slate-600">{locale === "th" ? "ข้อสงสัยทั่วไปเกี่ยวกับการจองตั๋ว" : locale === "ms" ? "Soalan umum mengenai tempahan tiket" : "Common questions about ticket booking"}</p>
      </header>

      <div className="space-y-3">
        {items.map((f, i) => (
          <details
            key={i}
            className="group rounded-lg border bg-white p-4 shadow-sm open:border-slate-300"
          >
            <summary className="cursor-pointer list-none font-medium">
              <span className="mr-2 text-slate-400 group-open:text-slate-700">Q.</span>
              {f.q}
            </summary>
            <p className="mt-3 border-t pt-3 text-sm text-slate-700">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
