export const metadata = { title: "ติดต่อเรา — Ticket Online" };

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ติดต่อเรา</h1>
        <p className="text-sm text-slate-600">มีคำถามเพิ่มเติม? ติดต่อทีมงานได้ตามช่องทางนี้</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card icon="📧" label="อีเมล" value="pattanifc2009@gmail.com" />
        <Card icon="📞" label="โทรศัพท์" value="+66(0) 73-123-4567" />
        <Card icon="🕐" label="เวลาทำการ" value="จันทร์–เสาร์ 09:00–18:00" />
        <Card icon="📍" label="ที่อยู่" value="ปัตตานี" />
      </div>

      <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
        <strong>หมายเหตุ:</strong> ข้อมูลด้านบนเป็นตัวอย่าง
        หลังพร้อมเปิดให้บริการจริง แก้ที่ไฟล์{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
          src/app/(public)/contact/page.tsx
        </code>
      </div>
    </div>
  );
}

function Card({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">
        <span className="mr-1" aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
