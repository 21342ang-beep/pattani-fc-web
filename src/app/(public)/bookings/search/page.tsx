import BookingSearchTabs from "./BookingSearchTabs";

export const metadata = { title: "ตรวจสอบการจอง — Pattani FC" };

export default function BookingSearchPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16 lg:py-20">
      <header>
        <p className="text-lg font-bold uppercase tracking-widest text-yellow-600 md:text-xl">Booking search</p>
        <h1 className="mt-2 text-4xl font-black text-green-900 md:text-5xl lg:text-6xl">ตรวจสอบการจอง</h1>
        <p className="mt-3 text-lg text-slate-600 md:text-xl lg:text-2xl">ลืมบันทึกบาร์โค้ด? กรอกชื่อผู้จอง หรือเบอร์โทรศัพท์ที่ใช้จอง เพื่อเรียกดู E-ticket ของคุณ</p>
      </header>
      <BookingSearchTabs />
    </div>
  );
}
