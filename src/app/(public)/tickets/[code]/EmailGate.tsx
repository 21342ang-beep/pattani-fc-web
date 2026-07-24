import Link from "next/link";

export default function PhoneGate() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-green-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black text-green-900">ยืนยันตัวตน</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          เพื่อความปลอดภัย กรุณายืนยันรหัส OTP จากเบอร์โทรศัพท์ที่ใช้จองก่อนเปิด E-Ticket
        </p>
        <Link href="/bookings/search" className="mt-5 inline-flex w-full justify-center rounded-full bg-green-800 px-5 py-3 text-base font-semibold text-yellow-300 transition hover:bg-green-900">
          ยืนยัน OTP และค้นหารายการจอง
        </Link>
      </div>
    </div>
  );
}
