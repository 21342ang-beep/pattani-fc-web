import CheckForm from "./CheckForm";

export const metadata = { title: "ตรวจสอบการจอง — Ticket Online" };

export default function CheckBookingPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold">ตรวจสอบการจอง</h1>
        <p className="text-sm text-slate-600">
          กรอกรหัสการจองและอีเมลที่ใช้ตอนจอง เพื่อดูสถานะ
        </p>
      </header>
      <CheckForm />
    </div>
  );
}
