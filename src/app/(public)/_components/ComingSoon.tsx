import Link from "next/link";

export default function ComingSoon({ note }: { note?: string }) {
  return (
    <div className="rounded-xl border border-yellow-300/60 bg-yellow-50 p-8 text-center">
      <p className="text-2xl">🚧</p>
      <h2 className="mt-2 text-lg font-semibold text-green-900">
        เนื้อหากำลังจัดทำ
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {note ?? "ทีมงานกำลังเตรียมเนื้อหาส่วนนี้ กลับมาเยี่ยมชมใหม่เร็วๆ นี้"}
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-green-900"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
