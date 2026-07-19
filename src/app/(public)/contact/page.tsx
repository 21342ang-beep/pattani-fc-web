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

      <section>
        <h2 className="text-lg font-bold text-green-900">ติดตามปัตตานี เอฟซี</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SocialCard href="https://www.facebook.com/PattaniFC" symbol="f" tone="bg-[#1877f2]" label="Facebook" handle="PattaniFC" />
          <SocialCard href="https://www.instagram.com/pattanifc.official/" symbol="◎" tone="bg-[#d62976]" label="Instagram" handle="@pattanifc.official" />
          <SocialCard href="https://www.youtube.com/@PattaniFCTV" symbol="▶" tone="bg-[#ff0000]" label="YouTube" handle="@PattaniFCTV" />
          <SocialCard href="https://www.tiktok.com/@pattanifc.official" symbol="♪" tone="bg-slate-900" label="TikTok" handle="@pattanifc.official" />
        </div>
      </section>
      <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-900">
        ติดต่อและติดตามข่าวสารของสโมสรได้ผ่านช่องทางด้านบน
      </div>
    </div>
  );
}

function SocialCard({ href, symbol, tone, label, handle }: { href: string; symbol: string; tone: string; label: string; handle: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md">
      <span className={`flex size-10 items-center justify-center rounded-lg text-xl font-black text-white ${tone}`} aria-hidden>{symbol}</span>
      <span><span className="block font-semibold text-green-900">{label}</span><span className="text-sm text-slate-500">{handle}</span></span>
    </a>
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
