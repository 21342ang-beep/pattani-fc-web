"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import {
  Gift,
  Loader2,
  PartyPopper,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  drawMemberWinners,
  type MemberDrawCandidate,
  type MemberDrawWinner,
} from "@/app/actions/member-draw";

type DisplayedWinner = MemberDrawWinner & { drawNumber: number };
type DrawStage = "idle" | "loading" | "spinning" | "winner";
type ActiveDraw = {
  winner: MemberDrawWinner;
  candidates: MemberDrawCandidate[];
};

const DEFAULT_SPIN_DURATION_MS = 4_400;

export default function MemberPrizeDraw({
  totalMembers,
}: {
  totalMembers: number;
}) {
  const [winners, setWinners] = useState<DisplayedWinner[]>([]);
  const [latestWinnerIds, setLatestWinnerIds] = useState<string[]>([]);
  const [remainingEligible, setRemainingEligible] = useState(totalMembers);
  const [error, setError] = useState<string | null>(null);
  const [drawStage, setDrawStage] = useState<DrawStage>("idle");
  const [activeDraw, setActiveDraw] = useState<ActiveDraw | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(DEFAULT_SPIN_DURATION_MS);
  const [pending, startTransition] = useTransition();
  const revealTimer = useRef<number | null>(null);
  const modalOpen = drawStage !== "idle";
  const drawing = pending || drawStage === "loading" || drawStage === "spinning";

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && drawStage === "winner") closePopup();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawStage, modalOpen]);

  useEffect(() => () => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
  }, []);

  function draw() {
    setError(null);
    setLatestWinnerIds([]);
    setActiveDraw(null);
    setWheelRotation(0);
    setDrawStage("loading");
    startTransition(async () => {
      const result = await drawMemberWinners({
        excludedIds: winners.map((winner) => winner.id),
      }).catch(() => null);
      if (!result) {
        setError("ไม่สามารถสุ่มรายชื่อได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
        setDrawStage("idle");
        return;
      }
      if (!result.ok) {
        setError(result.error);
        setDrawStage("idle");
        return;
      }

      const winner = result.winners[0];
      const winnerIndex = result.animationCandidates.findIndex(
        (candidate) => candidate.id === winner.id,
      );
      const sliceDegrees = 360 / result.animationCandidates.length;
      const finalRotation =
        360 * 7 - (Math.max(winnerIndex, 0) + 0.5) * sliceDegrees;
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 350
        : DEFAULT_SPIN_DURATION_MS;

      setActiveDraw({
        winner,
        candidates: result.animationCandidates,
      });
      setSpinDuration(duration);
      setDrawStage("spinning");

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setWheelRotation(finalRotation));
      });
      revealTimer.current = window.setTimeout(() => {
        setLatestWinnerIds([winner.id]);
        setWinners((current) => [{
          ...winner,
          drawNumber: current.length + 1,
        }, ...current]);
        setRemainingEligible(result.remainingEligible);
        setDrawStage("winner");
      }, duration + 180);
    });
  }

  function closePopup() {
    if (drawStage !== "winner") return;
    setDrawStage("idle");
    setActiveDraw(null);
    setWheelRotation(0);
  }

  function reset() {
    setWinners([]);
    setLatestWinnerIds([]);
    setRemainingEligible(totalMembers);
    setError(null);
    setDrawStage("idle");
    setActiveDraw(null);
    setWheelRotation(0);
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
                disabled={drawing || remainingEligible === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-300 px-6 py-3.5 text-lg font-black text-green-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {drawing ? <Loader2 className="size-6 animate-spin" /> : <Sparkles className="size-6" />}
                {drawing ? "กำลังสุ่ม..." : "สุ่มรายชื่อผู้โชคดี"}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={drawing || winners.length === 0}
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

      {modalOpen && (
        <DrawWheelModal
          activeDraw={activeDraw}
          stage={drawStage}
          rotation={wheelRotation}
          spinDuration={spinDuration}
          onClose={closePopup}
        />
      )}
    </div>
  );
}

function DrawWheelModal({
  activeDraw,
  stage,
  rotation,
  spinDuration,
  onClose,
}: {
  activeDraw: ActiveDraw | null;
  stage: DrawStage;
  rotation: number;
  spinDuration: number;
  onClose: () => void;
}) {
  const candidates = activeDraw?.candidates ?? [];
  const sliceDegrees = candidates.length > 0 ? 360 / candidates.length : 360;
  const colors = ["#14532d", "#facc15", "#166534", "#fde047"];
  const wheelBackground = candidates.length > 0
    ? `conic-gradient(${candidates.map((_, index) => (
        `${colors[index % colors.length]} ${index * sliceDegrees}deg ${(index + 1) * sliceDegrees}deg`
      )).join(", ")})`
    : "conic-gradient(#14532d, #facc15, #166534, #fde047, #14532d)";

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="presentation"
    >
      <section
        aria-describedby="draw-wheel-description"
        aria-labelledby="draw-wheel-title"
        aria-live="polite"
        aria-modal="true"
        className="relative my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-yellow-300/60 bg-gradient-to-b from-green-950 via-green-900 to-emerald-950 p-5 text-white shadow-2xl md:p-8"
        role="dialog"
      >
        {stage === "winner" && (
          <button
            type="button"
            aria-label="ปิดหน้าต่างผลการสุ่ม"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="size-6" />
          </button>
        )}

        <header className="pr-12 text-center">
          <p className="text-sm font-black tracking-[0.28em] text-yellow-300">PATTANI FC LUCKY DRAW</p>
          <h2 id="draw-wheel-title" className="mt-2 text-2xl font-black md:text-4xl">
            {stage === "winner" ? "ขอแสดงความยินดีกับผู้โชคดี!" : "กำลังหมุนวงล้อรายชื่อ"}
          </h2>
          <p id="draw-wheel-description" className="mt-2 text-sm text-green-100 md:text-base">
            {stage === "winner"
              ? "ผลการสุ่มถูกเลือกอย่างปลอดภัยจากระบบเรียบร้อยแล้ว"
              : "กรุณารอสักครู่ ระบบกำลังค้นหาผู้โชคดีประจำรอบนี้"}
          </p>
        </header>

        {stage === "loading" || !activeDraw ? (
          <div className="mx-auto mt-8 grid size-[min(72vw,22rem)] place-items-center rounded-full border-[12px] border-yellow-300 bg-[conic-gradient(#14532d,#facc15,#166534,#fde047,#14532d)] shadow-[0_0_50px_rgba(250,204,21,0.3)]">
            <div className="grid size-28 place-items-center rounded-full border-4 border-yellow-200 bg-green-950 shadow-xl">
              <Loader2 className="size-12 animate-spin text-yellow-300" />
            </div>
          </div>
        ) : (
          <div className="relative mx-auto mt-7 size-[min(78vw,26rem)]">
            <div className="absolute left-1/2 top-[-0.35rem] z-20 -translate-x-1/2 drop-shadow-lg">
              <div className="h-0 w-0 border-l-[18px] border-r-[18px] border-t-[34px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>
            <div
              className="relative size-full overflow-hidden rounded-full border-[10px] border-yellow-300 shadow-[0_0_60px_rgba(250,204,21,0.32)] will-change-transform"
              style={{
                background: wheelBackground,
                transform: `rotate(${rotation}deg)`,
                transition: `transform ${spinDuration}ms cubic-bezier(0.12, 0.72, 0.1, 1)`,
              }}
            >
              {candidates.map((candidate, index) => {
                const angle = (index + 0.5) * sliceDegrees;
                const labelStyle = {
                  "--wheel-radius": "clamp(6.6rem, 28vw, 9.4rem)",
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(var(--wheel-radius) * -1)) rotate(${-angle}deg)`,
                } as CSSProperties;
                return (
                  <span
                    key={candidate.id}
                    className="absolute left-1/2 top-1/2 w-24 truncate rounded-full bg-black/45 px-2 py-1 text-center text-[10px] font-black text-white shadow-sm sm:w-32 sm:text-xs"
                    style={labelStyle}
                    title={candidate.name}
                  >
                    {candidate.name}
                  </span>
                );
              })}
              <div className="absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-yellow-200 bg-green-950 text-center shadow-xl md:size-28">
                <Sparkles className={`size-9 text-yellow-300 ${stage === "spinning" ? "animate-pulse" : ""}`} />
              </div>
            </div>
          </div>
        )}

        {stage === "winner" && activeDraw && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-yellow-300 bg-yellow-50 p-5 text-center text-green-950 shadow-xl md:p-6">
            <PartyPopper className="mx-auto size-10 text-yellow-600" />
            <p className="mt-2 text-sm font-black uppercase tracking-wider text-green-700">ผู้โชคดีประจำรอบนี้</p>
            <p className="mt-1 text-3xl font-black md:text-5xl">{activeDraw.winner.name}</p>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              เบอร์โทรท้าย {activeDraw.winner.phoneLast4 === "—" ? "ไม่มีข้อมูล" : activeDraw.winner.phoneLast4}
              {activeDraw.winner.province ? ` · ${activeDraw.winner.province}` : ""}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-green-800 px-6 py-3 font-black text-yellow-200 transition hover:bg-green-900"
            >
              ปิดและดูรายชื่อผู้โชคดี
            </button>
          </div>
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
