"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Download, Loader2, Lock, QrCode, ShieldCheck } from "lucide-react";

type PaymentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; qrImageBase64: string; chargeId: string; expiresAt: string }
  | { status: "error"; message: string };

export default function PaymentGateway({
  bookingCode,
  seasonPassCode,
  amountBaht,
  successUrl: successUrlOverride,
}: {
  bookingCode?: string;
  seasonPassCode?: string;
  amountBaht: number;
  successUrl?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PaymentState>({ status: "idle" });
  const paymentParams = seasonPassCode
    ? `seasonPassCode=${encodeURIComponent(seasonPassCode)}`
    : `bookingCode=${encodeURIComponent(bookingCode ?? "")}`;
  const paymentBody = seasonPassCode ? { seasonPassCode } : { bookingCode };
  const successUrl = successUrlOverride ?? (seasonPassCode
    ? `/tickets/season/${encodeURIComponent(seasonPassCode)}`
    : `/tickets/${encodeURIComponent(bookingCode ?? "")}`);
  const qrFilename = `pattani-fc-promptpay-${(seasonPassCode ?? bookingCode ?? "payment")
    .replace(/[^a-z0-9-]/gi, "-")}.png`;

  useEffect(() => {
    if (state.status !== "ready") return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/payments/beam/status?${paymentParams}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as { confirmed?: boolean } | null;
      if (result?.confirmed) router.replace(successUrl);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paymentParams, router, state.status, successUrl]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const remaining = new Date(state.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      setState({ status: "error", message: "QR Code หมดอายุแล้ว กรุณาสร้าง QR ใหม่" });
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [state]);

  async function createPayment() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/payments/beam/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentBody),
      });
      const result = (await response.json().catch(() => null)) as {
        qrImageBase64?: string;
        chargeId?: string;
        expiresAt?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.qrImageBase64 || !result.chargeId || !result.expiresAt) {
        throw new Error(result?.error ?? "ไม่สามารถสร้างรายการชำระเงินได้");
      }
      setState({
        status: "ready",
        qrImageBase64: result.qrImageBase64,
        chargeId: result.chargeId,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    }
  }

  async function saveQrCode() {
    if (state.status !== "ready") return;

    const binary = window.atob(state.qrImageBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const file = new File([bytes], qrFilename, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Pattani FC PromptPay QR Code",
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = qrFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-gradient-to-r from-green-950 to-green-800 px-6 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <Lock className="size-4 text-yellow-300" />
          <span className="text-base font-bold tracking-wide md:text-lg">BEAM PROMPTPAY</span>
        </div>
        <p className="mt-2 text-sm text-white/70 md:text-base">
          ยืนยัน E-Ticket อัตโนมัติเมื่อ Beam แจ้งผลการชำระเงินสำเร็จ
        </p>
      </header>

      <div className="p-5 md:p-7">
        {state.status === "error" && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700 md:text-lg">
            {state.message}
          </p>
        )}

        {state.status !== "ready" ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-100 bg-green-50/60 p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-green-800 text-yellow-300"><QrCode className="size-6" /></span>
                <div>
                  <p className="text-lg font-bold text-green-950 md:text-xl">ชำระด้วย PromptPay QR</p>
                  <p className="text-base text-slate-600 md:text-lg">สแกนผ่านแอปธนาคารได้ทันที</p>
                </div>
              </div>
            </div>
            <p className="text-center text-4xl font-black text-green-900 md:text-5xl">
              {amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
            </p>
            <button
              type="button"
              onClick={createPayment}
              disabled={state.status === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-5 py-4 text-lg font-bold text-green-950 shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300 disabled:opacity-60 md:text-xl"
            >
              {state.status === "loading" && <Loader2 className="size-5 animate-spin" />}
              {state.status === "loading" ? "กำลังสร้าง QR ชำระเงิน..." : "สร้าง PromptPay QR"}
            </button>
          </div>
        ) : (
          <div className="space-y-5 text-center">
            <div className="rounded-xl border border-green-100 bg-green-50/60 p-4 text-left">
              <p className="text-base font-semibold text-green-900 md:text-lg">วิธีชำระเงิน</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-base text-slate-700 md:text-lg">
                <li>เปิดแอปธนาคารแล้วสแกน QR Code</li>
                <li>ตรวจสอบยอด {amountBaht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท แล้วกดยืนยัน</li>
                <li>รอสักครู่ ระบบจะเปิด E-Ticket ให้อัตโนมัติ</li>
              </ol>
            </div>
            <div className="mx-auto w-fit rounded-xl border-2 border-green-800 bg-white p-4">
              <Image
                src={`data:image/png;base64,${state.qrImageBase64}`}
                alt="Beam PromptPay QR Code"
                width={320}
                height={320}
                unoptimized
                className="size-72 max-w-full md:size-80"
              />
            </div>
            <div className="mx-auto max-w-md space-y-2">
              <button
                type="button"
                onClick={saveQrCode}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-5 py-3.5 text-lg font-bold text-yellow-300 shadow-sm transition hover:bg-green-900"
              >
                <Download className="size-5" />
                บันทึก QR Code ลงเครื่อง
              </button>
              <p className="text-sm leading-relaxed text-slate-500 md:text-base">
                หากจองผ่านมือถือเครื่องเดียว ให้บันทึกรูปนี้แล้วเลือกจากคลังรูปในแอปธนาคาร
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-base text-slate-500 md:text-lg">
              <Loader2 className="size-4 animate-spin text-green-800" /> กำลังรอผลการชำระเงินจาก Beam
            </div>
            <p className="text-sm text-slate-400">
              QR หมดอายุ {new Date(state.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
              <br />เลขอ้างอิง: {state.chargeId}
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500 md:text-base">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-green-700" /> ระบบจะไม่ยืนยันการจองจากการกดปุ่มหน้าเว็บไซต์</span>
      </footer>
    </div>
  );
}
