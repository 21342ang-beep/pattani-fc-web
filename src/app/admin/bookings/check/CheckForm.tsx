"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CreditCard, Ticket, Loader2 } from "lucide-react";
import { lookupBooking, type LookupState } from "@/app/actions/lookupBooking";
import { formatBaht, formatDateTime } from "@/lib/format";

const statusLabel: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "รอชำระเงิน / ยืนยัน", cls: "bg-amber-100 text-amber-800" },
  CONFIRMED: { text: "ยืนยันแล้ว", cls: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { text: "ยกเลิก", cls: "bg-slate-100 text-slate-600" },
  REFUNDED: { text: "คืนเงินแล้ว", cls: "bg-blue-100 text-blue-800" },
};

// ตรวจ format ฝั่ง client ก่อน → ตัด traffic ที่ไม่จำเป็น
const CODE_FORMAT = /^[a-z0-9]{8,50}$/i;

export default function CheckForm() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<LookupState>(undefined);
  const [isPending, startTransition] = useTransition();

  // debounce auto-lookup เมื่อ code valid → ไม่ยิง action ทุกคีย์สโตรก
  useEffect(() => {
    const trimmed = code.trim();
    if (!CODE_FORMAT.test(trimmed)) {
      setState(undefined);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("bookingCode", trimmed);
        const next = await lookupBooking(undefined, fd);
        setState(next);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [code]);

  const result = state?.result;
  const checkoutHref = result ? `/checkout/${result.bookingCode}` : "#";
  const ticketHref = result ? `/tickets/${result.bookingCode}` : "#";

  return (
    <>
      <div className="space-y-3 rounded-lg border bg-white p-6 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium">รหัสการจอง</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={50}
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono"
            placeholder="เช่น c0xxxxxxxxxx..."
          />
        </label>

        {isPending && (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="size-3.5 animate-spin" /> กำลังตรวจสอบ...
          </p>
        )}
        {state?.error && !isPending && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {!code.trim() && (
          <p className="text-xs text-slate-500">
            ใส่รหัสการจองที่ได้รับหลังจอง — ระบบจะแสดงผลทันทีเมื่อรหัสถูกต้อง
          </p>
        )}
      </div>

      {result && (
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">รายละเอียดการจอง</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="รหัสการจอง">
              <span className="font-mono">{result.bookingCode}</span>
            </Row>
            <Row label="สถานะ">
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  statusLabel[result.status]?.cls ?? "bg-slate-100"
                }`}
              >
                {statusLabel[result.status]?.text ?? result.status}
              </span>
            </Row>
            <Row label="ผู้จอง">{result.customerName}</Row>
            <Row label="แมตช์">
              {result.match.homeTeam} vs {result.match.awayTeam}
            </Row>
            <Row label="สนาม">{result.match.venue ?? "—"}</Row>
            <Row label="เวลา">
              {result.match.kickoffAt
                ? formatDateTime(result.match.kickoffAt)
                : "—"}
            </Row>
            <Row label="จำนวน">{result.quantity} ใบ</Row>
            <Row label="ยอดรวม">{formatBaht(result.totalAmount)}</Row>
            <Row label="วันที่จอง">{formatDateTime(result.createdAt)}</Row>
          </dl>

          {/* ปุ่ม action ตามสถานะ — phone gate จะถูกถามต่อในหน้าปลายทาง */}
          {result.status === "PENDING" && (
            <Link
              href={checkoutHref}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-base font-bold text-green-950 shadow-lg shadow-yellow-400/20 transition hover:scale-[1.01] hover:bg-yellow-300"
            >
              <CreditCard className="size-5" /> ชำระเงิน
              <ArrowRight className="size-5" />
            </Link>
          )}
          {result.status === "CONFIRMED" && (
            <Link
              href={ticketHref}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-800 px-6 py-3 text-base font-bold text-yellow-300 transition hover:bg-green-900"
            >
              <Ticket className="size-5" /> ดู E-Ticket
              <ArrowRight className="size-5" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 text-slate-500">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}
