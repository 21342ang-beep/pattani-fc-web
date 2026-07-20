export const metadata = { title: "คำถามที่พบบ่อย — Ticket Online" };

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

export default function FAQPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 md:py-16">
      <header>
        <h1 className="text-2xl font-bold">คำถามที่พบบ่อย</h1>
        <p className="text-sm text-slate-600">ข้อสงสัยทั่วไปเกี่ยวกับการจองตั๋ว</p>
      </header>

      <div className="space-y-3">
        {faqs.map((f, i) => (
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
