"use client";

import { useState, useTransition } from "react";
import { Gift, Loader2, RotateCcw, Sparkles, Trophy } from "lucide-react";
import {
  drawMemberWinners,
  type MemberDrawWinner,
} from "@/app/actions/member-draw";

type DisplayedWinner = MemberDrawWinner & { drawNumber: number };

export default function MemberPrizeDraw({
  totalMembers,
}: {
  totalMembers: number;
}) {
  const [winners, setWinners] = useState<DisplayedWinner[]>([]);
  const [latestWinnerIds, setLatestWinnerIds] = useState<string[]>([]);
  const [remainingEligible, setRemainingEligible] = useState(totalMembers);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function draw() {
    setError(null);
    setLatestWinnerIds([]);
    startTransition(async () => {
      const result = await drawMemberWinners({
        excludedIds: winners.map((winner) => winner.id),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLatestWinnerIds(result.winners.map((winner) => winner.id));
      setWinners((current) => [
        ...result.winners.map((winner, index) => ({
          ...winner,
          drawNumber: current.length + index + 1,
        })),
        ...current,
      ]);
      setRemainingEligible(result.remainingEligible);
    });
  }

  function reset() {
    setWinners([]);
    setLatestWinnerIds([]);
    setRemainingEligible(totalMembers);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-yellow-300 bg-gradient-to-br from-green-950 via-green-800 to-emerald-700 text-white shadow-xl">
        <div className="grid gap-8 p-6 md:p-9 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-3 py-1 text-sm font-black text-green-950">
              <Gift className="size-4" /> MEMBER LUCKY DRAW
            </div>
            <h2 className="mt-4 text-3xl font-black md:text-5xl">สุ่มผู้โชคดีสมาชิก Pattani FC</h2>
            <p className="mt-3 max-w-2xl text-base text-green-50 md:text-lg">
              สุ่มจากสมาชิกทั้งหมดทั้งผู้ที่ยืนยันเบอร์และยังไม่ยืนยัน ครั้งละ 1 คน และผู้ชนะจะไม่ซ้ำกันภายในรอบนี้
            </p>

            <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="font-bold text-yellow-200">กลุ่มที่ร่วมลุ้น: สมาชิกทั้งหมด</p>
              <p className="mt-1 text-sm text-green-50">
                รวมสมาชิกที่ยืนยันเบอร์แล้วและยังไม่ยืนยัน · สุ่มครั้งละ 1 คน
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={draw}
                disabled={pending || remainingEligible === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-300 px-6 py-3.5 text-lg font-black text-green-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-6 animate-spin" /> : <Sparkles className="size-6" />}
                {pending ? "กำลังสุ่ม..." : "สุ่มรายชื่อผู้โชคดี"}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={pending || winners.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3.5 text-base font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="size-5" /> ล้างผลและเริ่มรอบใหม่
              </button>
            </div>
            {error && <p className="mt-4 rounded-xl bg-red-950/60 px-4 py-3 font-semibold text-red-50">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="สมาชิกในกลุ่ม" value={totalMembers} />
            <Stat label="เหลือให้สุ่ม" value={remainingEligible} />
            <Stat label="ผู้ชนะแล้ว" value={winners.length} />
            <Stat label="สุ่มครั้งละ" value={1} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-3">
          <Trophy className="size-8 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-black text-green-950 md:text-3xl">รายชื่อผู้โชคดีในรอบนี้</h2>
            <p className="text-sm text-slate-600">ผลจะอยู่ในหน้านี้จนกดเริ่มรอบใหม่หรือรีเฟรชหน้า</p>
          </div>
        </div>

        {winners.length === 0 ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-green-200 bg-green-50/60 p-12 text-center">
            <Gift className="mx-auto size-14 text-green-700" />
            <p className="mt-3 text-xl font-bold text-green-900">ยังไม่มีผลการสุ่ม</p>
            <p className="mt-1 text-slate-600">เลือกกลุ่มสมาชิกและกดปุ่มสุ่มรายชื่อด้านบน</p>
          </div>
        ) : (
          <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {winners.map((winner, index) => {
              const isLatest = latestWinnerIds.includes(winner.id);
              return (
                <li
                  key={winner.id}
                  className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${isLatest ? "border-yellow-400 bg-yellow-50 ring-4 ring-yellow-200/60" : "border-green-100 bg-white"}`}
                >
                  <span className="absolute right-3 top-3 text-5xl font-black text-green-900/10">#{winner.drawNumber}</span>
                  {isLatest && <span className="inline-flex rounded-full bg-yellow-300 px-2.5 py-1 text-xs font-black text-green-950">ผู้ชนะล่าสุด</span>}
                  <p className="mt-3 pr-12 text-2xl font-black text-green-950">{winner.name}</p>
                  <dl className="mt-4 space-y-2 text-sm text-slate-600">
                    <Detail label="เบอร์โทรท้าย 4 ตัว" value={winner.phoneLast4 === "—" ? "ไม่มีข้อมูล" : `•••• ${winner.phoneLast4}`} />
                    <Detail label="สถานะเบอร์โทร" value={winner.phoneVerified ? "ยืนยันเบอร์แล้ว" : "ยังไม่ยืนยันเบอร์"} />
                    <Detail label="จังหวัด" value={winner.province ?? "ไม่ระบุ"} />
                    <Detail label="สมัครเมื่อ" value={new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(winner.registeredAt))} />
                  </dl>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur-sm">
      <p className="text-sm font-semibold text-green-100">{label}</p>
      <p className="mt-1 text-3xl font-black text-yellow-300 md:text-4xl">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right font-bold text-slate-800">{value}</dd>
    </div>
  );
}
