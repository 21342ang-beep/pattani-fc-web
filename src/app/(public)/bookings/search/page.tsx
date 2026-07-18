import BookingSearchTabs from "./BookingSearchTabs";

export const metadata = { title: "ตรวจสอบการจอง — Pattani FC" };

export default function BookingSearchPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header>
        <p className="text-sm font-bold uppercase tracking-widest text-yellow-600">Booking search</p>
        <h1 className="mt-1 text-3xl font-black text-green-900">ตรวจสอบการจอง</h1>
        <p className="mt-2 text-slate-600">ลืมบันทึกบาร์โค้ด? กรอกชื่อผู้จอง หรือเบอร์โทรศัพท์ที่ใช้จอง เพื่อเรียกดู E-ticket ของคุณ</p>
      </header>
      <BookingSearchTabs />
    </div>
  );
}
