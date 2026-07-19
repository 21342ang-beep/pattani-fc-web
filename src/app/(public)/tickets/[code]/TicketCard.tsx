"use client";

import { toPng } from "html-to-image";
import { Printer, Download, Shield, Zap } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  booking: {
    bookingCode: string;
    customerName: string;
    quantity: number;
    zone: string | null;
    unitPrice: string;
    paymentMethod: string;
    paidAt: string;
    match: {
      homeTeam: string;
      awayTeam: string;
      homeTeamLogo: string | null;
      awayTeamLogo: string | null;
      venue: string;
      kickoffAt: string;
    };
  };
  barcodeSvg: string;
};

function formatKickoffParts(s: string): { date: string; time: string } {
  if (!s || s === "—") return { date: "—", time: "—" };
  const match = s.match(/(\d{1,2}:\d{2})/);
  if (!match) return { date: s, time: "" };
  const time = match[1];
  const date = s.replace(time, "").trim().replace(/,$/, "").trim();
  return { date: date || s, time };
}

// fallback logo ถ้าทีมเหย้า/เยือนยังไม่มีโลโก้ใน DB
// home → ใช้โลโก้ Pattani FC ทันที, away → ใช้ไอคอน Shield
function resolveLogo(
  raw: string | null,
  teamName: string
): { src: string | null; useFallback: boolean } {
  if (raw) return { src: raw, useFallback: false };
  // ถ้าเป็นทีมเหย้า "Pattani FC" ใช้โลโก้สโมสร
  if (/pattani/i.test(teamName)) return { src: "/logo-pattani-fc.png", useFallback: false };
  return { src: null, useFallback: true };
}

const METHOD_LABEL: Record<string, string> = {
  PROMPTPAY: "PromptPay",
  MOBILE_BANKING: "Mobile Banking",
  CREDIT_CARD: "Credit Card",
};

export default function TicketCard({ booking, barcodeSvg }: Props) {
  const ticketRef = useRef<HTMLElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const { date, time } = formatKickoffParts(booking.match.kickoffAt);
  const home = resolveLogo(booking.match.homeTeamLogo, booking.match.homeTeam);
  const away = resolveLogo(booking.match.awayTeamLogo, booking.match.awayTeam);
  const ticketReference = `${booking.zone ?? "GENERAL"} · ${booking.unitPrice}`;
  const barcodeReference = `${booking.zone ?? "GENERAL"}-${booking.unitPrice.replace(/\D/g, "")}-${booking.bookingCode.slice(-8).toUpperCase()}`;

  async function saveTicket() {
    if (!ticketRef.current || isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const ticketImages = Array.from(ticketRef.current.querySelectorAll("img"));
      await Promise.all(
        ticketImages.map((image) =>
          image.complete ? image.decode?.().catch(() => undefined) : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
        ),
      );
      const dataUrl = await toPng(ticketRef.current, {
        backgroundColor: "#0a1e15",
        cacheBust: true,
        pixelRatio: 2,
      });
      const imageBlob = await fetch(dataUrl).then((response) => response.blob());
      const filename = `pattanifc-eticket-${booking.bookingCode}.png`;
      const imageFile = new File([imageBlob], filename, { type: "image/png" });
      const canShareImage = navigator.canShare?.({ files: [imageFile] });

      if (canShareImage) {
        await navigator.share({
          title: "Pattani FC E-ticket",
          text: "บันทึก E-ticket ของคุณ",
          files: [imageFile],
        });
        setSaveMessage("เลือก “บันทึกรูปภาพ” เพื่อเก็บ E-ticket ลงใน Gallery");
        return;
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      link.click();
      setSaveMessage("บันทึก E-ticket แล้ว");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setSaveMessage("ไม่สามารถบันทึก E-ticket ได้ กรุณาลองใหม่");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-[100svh] bg-slate-100 py-0 print:min-h-0 print:bg-white print:py-0 sm:py-8 md:py-12">
      <div className="mx-auto max-w-2xl px-0 print:max-w-none print:px-0 sm:px-4">
        {/* Action bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-4 pt-4 print:hidden sm:mb-5 sm:px-0 sm:pt-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
              ชำระเงินสำเร็จ
            </p>
            <h1 className="mt-0.5 text-2xl font-black text-green-900 md:text-3xl">
              E-Ticket
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveTicket}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-4 py-2 text-xs font-semibold text-green-950 transition hover:bg-yellow-300 disabled:cursor-wait disabled:opacity-70"
            >
              <Download className="size-3.5" /> {isSaving ? "กำลังบันทึก..." : <><span className="sm:hidden">บันทึก E-ticket</span><span className="hidden sm:inline">บันทึกตั๋ว</span></>}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-4 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-green-900"
            >
              <Printer className="size-3.5" /> พิมพ์ตั๋ว
            </button>
          </div>
        </div>
        {saveMessage && <p aria-live="polite" className="mb-3 px-4 text-center text-xs text-slate-600 print:hidden sm:px-0">{saveMessage}</p>}

        {/* Ticket */}
        <article
          ref={ticketRef}
          aria-label="E-Ticket Pattani FC"
          className="relative grid min-h-[calc(100svh-6.5rem)] grid-cols-1 overflow-hidden rounded-none bg-[#0a1e15] shadow-2xl shadow-black/40 ring-1 ring-black/40 sm:min-h-0 sm:rounded-xl md:grid-cols-[1fr_220px] print:min-h-0 print:rounded-none print:shadow-none print:ring-0"
        >
          {/* ===== MAIN PANEL ===== */}
          <main className="relative overflow-hidden px-5 py-5 text-white md:px-8 md:py-7">
            {/* Stadium glow background */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(34,197,94,0.35) 0%, rgba(10,30,21,0) 70%), radial-gradient(ellipse 40% 30% at 50% 40%, rgba(59,130,246,0.25) 0%, transparent 70%), linear-gradient(180deg, #07150e 0%, #0a1e15 50%, #061008 100%)",
              }}
            />
            {/* Dot pattern overlay */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:14px_14px]"
            />
            {/* Crowd silhouette (CSS only) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-5 opacity-50"
              style={{
                background:
                  "radial-gradient(circle at 5% 100%, #000 8px, transparent 9px), radial-gradient(circle at 12% 100%, #000 10px, transparent 11px), radial-gradient(circle at 22% 100%, #000 9px, transparent 10px), radial-gradient(circle at 33% 100%, #000 11px, transparent 12px), radial-gradient(circle at 44% 100%, #000 9px, transparent 10px), radial-gradient(circle at 55% 100%, #000 12px, transparent 13px), radial-gradient(circle at 66% 100%, #000 9px, transparent 10px), radial-gradient(circle at 77% 100%, #000 11px, transparent 12px), radial-gradient(circle at 88% 100%, #000 10px, transparent 11px), radial-gradient(circle at 95% 100%, #000 9px, transparent 10px)",
              }}
            />

            <div className="relative flex h-full flex-col">
              {/* Header tag */}
              <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.35em] text-white/70">
                <span className="h-px w-4 bg-white/40" />
                ✦ Football Match ✦
                <span className="h-px w-4 bg-white/40" />
              </p>

              {/* Title */}
              <h2 className="mt-1 text-center text-4xl font-black uppercase leading-none tracking-tight text-white">
                Match Day
              </h2>
              <p className="mt-1 text-center text-xs font-bold uppercase tracking-[0.22em] text-yellow-400">
                The Battle Begins
              </p>

              {/* Crests + VS */}
              <div className="mt-5 flex items-center justify-center gap-5">
                <TeamCrest
                  name={booking.match.homeTeam}
                  logo={home.src}
                  useFallback={home.useFallback}
                  tone="home"
                />
                <div className="flex flex-col items-center">
                  <Zap
                    className="size-9 fill-white text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                    VS
                  </span>
                </div>
                <TeamCrest
                  name={booking.match.awayTeam}
                  logo={away.src}
                  useFallback={away.useFallback}
                  tone="away"
                />
              </div>

              {/* Match info */}
              <div className="mt-5 text-center">
                <p className="text-base font-bold uppercase tracking-[0.15em] text-white">
                  {date}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Kick off {time || "—"} · {booking.match.venue}
                </p>
              </div>

              {/* meta bottom */}
              <div className="mt-auto pt-4 text-xs text-white/60">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span>
                    <span className="text-white/40">ผู้ซื้อ </span>
                    <span className="text-white/90">{booking.customerName}</span>
                  </span>
                  <span>
                    <span className="text-white/40">No. </span>
                    <span className="font-mono text-white/90">
                      {booking.bookingCode.slice(-10).toUpperCase()}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </main>

          {/* Perforation */}
          <Perforation />

          {/* ===== RIGHT STUB ===== */}
          <aside className="relative flex flex-col gap-3 overflow-hidden bg-[#0a1e15] px-4 py-5 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:10px_10px]"
            />
            <div className="relative flex flex-col gap-3">
              <div className="border-y border-white/10 py-2 text-[11px]">
                <StubRow label="Date" value={date} />
                <StubRow label="Kick off" value={time || "—"} />
              </div>

              <div className="rounded-lg bg-white p-2">
                <div
                  className="[&_svg]:h-auto [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                />
                <p className="mt-1 text-center font-mono text-[10px] font-bold tracking-[0.16em] text-green-950">
                  {barcodeReference}
                </p>
              </div>

              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  Ticket type
                </p>
                <p className="mt-1 text-2xl font-black leading-none text-yellow-400">
                  {ticketReference}
                </p>
                <p className="text-[8px] text-white/40">
                  {METHOD_LABEL[booking.paymentMethod] ?? booking.paymentMethod}
                </p>
              </div>

              <div className="border-y border-white/10 py-2 text-[11px]">
                <StubRow label="Stadium" value={booking.match.venue} />
              </div>
            </div>
          </aside>
        </article>

        <p className="mt-3 text-center text-[11px] text-slate-500 print:hidden">
          ตั๋วใบนี้ใช้ได้ครั้งเดียว · ห้ามจำหน่ายต่อ · เก็บรักษาบาร์โค้ดให้ปลอดภัย
        </p>
      </div>
    </div>
  );
}

function TeamCrest({
  name,
  logo,
  useFallback,
  tone,
}: {
  name: string;
  logo: string | null;
  useFallback: boolean;
  tone: "home" | "away";
}) {
  const ringCls =
    tone === "home"
      ? "ring-yellow-400/60 from-yellow-300/20 to-green-700/30"
      : "ring-blue-400/60 from-blue-300/20 to-blue-900/30";
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative flex size-[4.5rem] items-center justify-center rounded-full bg-gradient-to-b ${ringCls} ring-2 backdrop-blur-sm`}
      >
        {logo && !useFallback ? (
          <div className="relative size-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={name} className="size-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
          </div>
        ) : (
          <Shield
            className={`size-9 ${
              tone === "home" ? "text-yellow-400" : "text-blue-300"
            } drop-shadow-md`}
            strokeWidth={1.5}
          />
        )}
      </div>
      <p className="mt-2 max-w-28 truncate text-center text-xs font-bold uppercase tracking-widest text-white">
        {name}
      </p>
    </div>
  );
}

function Perforation() {
  return (
    <div aria-hidden className="relative hidden md:block">
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-white/20" />
      <div className="absolute -top-2.5 left-1/2 size-5 -translate-x-1/2 rounded-full bg-slate-100 print:bg-white" />
      <div className="absolute -bottom-2.5 left-1/2 size-5 -translate-x-1/2 rounded-full bg-slate-100 print:bg-white" />
    </div>
  );
}

function StubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1.5 py-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/80">
        {label}
      </span>
      <span className="truncate text-right text-sm font-bold text-white">
        {value}
      </span>
    </div>
  );
}
